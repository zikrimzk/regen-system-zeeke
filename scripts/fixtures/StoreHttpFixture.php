<?php
declare(strict_types=1);

use ReGen\{AdminAccess,AdminRepository,BonusCreditService,Config,FeaturePricing,ResumeRepository,TemplateCatalog,TokenStore,UserRepository};

/** Disposable localhost database and PHP server; no production mail, AI or provider calls. */
final class StoreHttpFixture
{
    public readonly string $directory;
    public readonly string $database;
    public readonly string $hitpayWebhookSalt;
    public string $base;
    private ?PDO $serverDatabase = null;
    private ?PDO $db = null;
    private mixed $server = null;
    private bool $created = false;
    private bool $schemaReady = false;

    public function __construct(private readonly string $root, private readonly bool $mockMochi = false, private readonly ?int $mailSinkPort = null)
    {
        $suffix = bin2hex(random_bytes(6));
        $this->directory = $root . '/tmp/store-http-' . $suffix;
        $this->database = 'regen_store_http_' . $suffix;
        $this->hitpayWebhookSalt = bin2hex(random_bytes(32));
    }

    public function start(): array
    {
        Config::load(getenv('REGEN_HTTP_FIXTURE_CONFIG') ?: $this->root);
        if (!in_array(Config::get('app.env'), ['development','test','testing'], true)
            || !in_array(Config::get('db.host'), ['localhost','127.0.0.1','::1'], true)) {
            throw new RuntimeException('HTTP checks require local development MySQL.');
        }
        mkdir($this->directory, 0700, true);
        $dsn = 'mysql:host=' . Config::get('db.host') . ';port=' . Config::get('db.port');
        $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false, PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='+00:00'"];
        $this->serverDatabase = new PDO($dsn, Config::get('db.user'), Config::get('db.password'), $options);
        $this->serverDatabase->exec('CREATE DATABASE `' . $this->database . '` CHARACTER SET utf8mb4');
        $this->created = true;
        $this->db = new PDO($dsn . ';dbname=' . $this->database . ';charset=utf8mb4', Config::get('db.user'), Config::get('db.password'), $options);
        $this->db->exec(file_get_contents($this->root . '/database/schema.sql'));
        $this->schemaReady = true;

        // Legacy pricing tests opt into open access explicitly; strict-access tests reset these rules.
        $this->db->exec("UPDATE feature_prices SET mode='free',token_cost=0,version=0");

        $users = new UserRepository($this->db);
        $user = $users->create(['firstName'=>'Amina','lastName'=>'Rahman','email'=>'amina@qa.regen.local','password'=>'New-Password-567890']);
        $users->create(['firstName'=>'Other','lastName'=>'Person','email'=>'other@qa.regen.local','password'=>'Qa-Other-567890']);
        $this->db->exec('UPDATE users SET email_verified_at=UTC_TIMESTAMP()');
        $admins = new AdminRepository($this->db);
        $admin = $admins->createAdmin(['firstName'=>'Jamie','lastName'=>'Morgan','email'=>'jamie@qa.regen.local','password'=>'Qa-Admin-567891','role'=>'super_admin']);
        $delegate = $admins->createAdmin(['firstName'=>'Support','lastName'=>'Agent','email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890','role'=>'admin']);
        $this->db->exec('UPDATE admins SET must_change_password=0');
        (new AdminAccess($this->db))->assign($delegate, ['capabilities'=>['support.view','support.manage'],'purpose'=>'Isolated HTTP support verification.','version'=>0], $admin);
        (new BonusCreditService($this->db))->adjust((int)$user['id'], 30, 'QA reward balance', 'test', 'store-http-starting-balance');
        $store = new TokenStore($this->db);
        foreach ([['A fresh start',30,0,1200],['Room to grow',80,10,2900],['Your next chapter',180,25,5900]] as $index => [$name,$tokens,$bonus,$price]) {
            $store->savePackage(null, ['name'=>$name,'description'=>'Fictional QA package.','tokens'=>$tokens,'bonusTokens'=>$bonus,
                'priceMinor'=>$price,'currency'=>'MYR','badge'=>'','highlighted'=>$index===1,'active'=>true,'sortOrder'=>$index], $admin);
        }
        $this->db->exec("UPDATE feature_prices SET mode='free',token_cost=0 WHERE feature_key='templates'");
        $resume = (new ResumeRepository($this->db))->getOrCreatePrimary((int)$user['id'], $users->findById((int)$user['id']), 'QA resume');
        $pricing = new FeaturePricing($this->db);
        foreach (['templates'=>4,'document_settings'=>5,'pdf_download'=>2] as $key => $cost) {
            $pricing->save($key, ['mode'=>$key==='pdf_download'?'per_use':'unlock','cost'=>$cost,'version'=>0], $admin);
        }

        $this->db->prepare('UPDATE resumes SET resume_data=? WHERE id=?')->execute([json_encode(TemplateCatalog::sample('classic')), $resume['id']]);
        $image = imagecreatetruecolor(160,100);
        imagefill($image,0,0,imagecolorallocate($image,17,93,66));
        imagepng($image,$this->directory . '/screenshot.png');
        imagedestroy($image);
        copy($this->root . '/public/samples/classic.pdf', $this->directory . '/details.pdf');
        file_put_contents($this->directory . '/invalid.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $socket = stream_socket_server('tcp://127.0.0.1:0', $number, $message);
        if (!$socket) throw new RuntimeException('A localhost QA port is unavailable.');
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        $this->base = 'http://' . $address;
        $router = '<?php $root=' . var_export($this->root,true) . ';$fixtureDatabase=' . var_export($this->database,true)
            . ';$base=' . var_export($this->base,true) . ';$hitpayWebhookSalt=' . var_export($this->hitpayWebhookSalt,true)
            . ';$mockMochi=' . var_export($this->mockMochi,true)
            . ';$mailSinkPort=' . var_export($this->mailSinkPort,true)
            . ';return require ' . var_export(__DIR__ . '/store-router.php',true) . ';';
        file_put_contents($this->directory . '/router.php', $router);
        $this->server = proc_open([PHP_BINARY,'-d','upload_max_filesize=8M','-d','post_max_size=32M','-S',$address,'-t',$this->root . '/public',$this->directory . '/router.php'],
            [0=>['pipe','r'],1=>['file',$this->directory . '/server.log','a'],2=>['file',$this->directory . '/server.log','a']],$pipes,$this->root);
        if (!is_resource($this->server)) throw new RuntimeException('The QA server could not start.');
        fclose($pipes[0]);
        $ready = false;
        for ($attempt=0;$attempt<60;$attempt++) {
            $handle=curl_init($this->base . '/api/health');
            curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>1]);
            $body=(string)curl_exec($handle);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);unset($handle);
            if ($status===200 && (json_decode($body,true)['success']??false)) {$ready=true;break;}
            usleep(100000);
        }
        if (!$ready) throw new RuntimeException('The isolated QA server did not become ready.');
        return ['database'=>$this->database,'userId'=>(int)$user['id'],'resumeId'=>(int)$resume['id']];
    }

    public function close(): void
    {
        if (is_resource($this->server)) {proc_terminate($this->server);proc_close($this->server);}
        if ($this->created) {
            if ($this->db?->inTransaction()) $this->db->rollBack();
            $keys=$this->schemaReady?$this->db->query('SELECT storage_key FROM support_attachments')->fetchAll(PDO::FETCH_COLUMN):[];
            foreach ($keys as $key) {
                if (preg_match('/^[a-f0-9]{64}$/D',$key)) @unlink($this->root . '/storage/support-attachments/' . $key);
            }
            if (!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$this->database) || $this->database===Config::get('db.name')) throw new RuntimeException('Unsafe QA database cleanup.');
            $this->db=null;
            $this->serverDatabase->exec('DROP DATABASE `' . $this->database . '`');
        }
        if (is_dir($this->directory)) {
            $resolved=str_replace('\\','/',realpath($this->directory));
            if (!str_starts_with($resolved,str_replace('\\','/',realpath($this->root . '/tmp')) . '/store-http-')) throw new RuntimeException('Unsafe QA directory cleanup.');
            foreach (new DirectoryIterator($this->directory) as $file) if ($file->isFile() && !$file->isLink()) unlink($file->getPathname());
            rmdir($this->directory);
        }
    }
}
