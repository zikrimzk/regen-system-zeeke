<?php
declare(strict_types=1);

namespace ReGen;

final class RuntimeMailSettings
{
    public function __construct(private readonly string $root) {}

    private function path(): string
    {
        return $this->root.'/storage/configuration';
    }

    public function read(): array
    {
        $path=$this->path();
        if (!is_file($path.'/mail.json')) return [];
        $key=file_get_contents($path.'/mail.key');
        $envelope=json_decode((string)file_get_contents($path.'/mail.json'),true,16,JSON_THROW_ON_ERROR);
        $plain=openssl_decrypt(base64_decode($envelope['data'],true),'aes-256-gcm',$key,OPENSSL_RAW_DATA,base64_decode($envelope['iv'],true),base64_decode($envelope['tag'],true));
        if ($plain===false) throw new \RuntimeException('Saved email configuration cannot be decrypted.');
        return json_decode($plain,true,16,JSON_THROW_ON_ERROR);
    }

    public function publicSettings(): array
    {
        $current=$this->read();
        return [
            'host'=>$current['mail.smtp_host']??Config::get('mail.smtp_host',''),
            'port'=>(int)($current['mail.smtp_port']??Config::get('mail.smtp_port',587)),
            'username'=>$current['mail.smtp_username']??Config::get('mail.smtp_username',''),
            'encryption'=>$current['mail.smtp_encryption']??Config::get('mail.smtp_encryption','tls'),
            'fromEmail'=>$current['mail.from_email']??Config::get('mail.from_email',''),
            'fromName'=>$current['mail.from_name']??Config::get('mail.from_name','ReGen'),
            'passwordConfigured'=>($current['mail.smtp_password']??Config::get('mail.smtp_password',''))!=='',
            'savedInPortal'=>is_file($this->path().'/mail.json'),
        ];
    }

    public function validate(array $body): array
    {
        $host=trim((string)($body['host']??''));$port=filter_var($body['port']??null,FILTER_VALIDATE_INT);
        $username=trim((string)($body['username']??''));$from=trim((string)($body['fromEmail']??''));$name=Sanitizer::cleanText($body['fromName']??'ReGen',false,100);
        $encryption=(string)($body['encryption']??'');
        $current=$this->read();
        $password=(string)($body['smtpPassword']??'');
        if ($password==='') $password=(string)($current['mail.smtp_password']??Config::get('mail.smtp_password',''));
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/D',$host) || !in_array($port,[25,465,587,2525],true)
            || !in_array($encryption,['tls','ssl'],true) || $username==='' || preg_match('/[\r\n]/',$username) || strlen($username)>200
            || !filter_var($from,FILTER_VALIDATE_EMAIL) || $name==='' || $password==='' || strlen($password)>1000) {
            throw new \DomainException('Enter a valid SMTP host, supported port, TLS encryption, username, password and sender address.');
        }
        return ['mail.transport'=>'smtp','mail.smtp_host'=>$host,'mail.smtp_port'=>$port,'mail.smtp_username'=>$username,'mail.smtp_password'=>$password,'mail.smtp_encryption'=>$encryption,'mail.from_email'=>$from,'mail.from_name'=>$name];
    }

    public function save(array $body): void
    {
        $data=$this->validate($body);$directory=$this->path();
        if (!is_dir($directory) && !mkdir($directory,0700,true)) throw new \RuntimeException('Email configuration storage is not writable.');
        $lock=fopen($directory.'/mail.lock','c');
        if (!$lock || !flock($lock,LOCK_EX)) throw new \RuntimeException('Email configuration is currently being changed.');
        try {
            if (!is_file($directory.'/mail.key')) {
                $keyFile=fopen($directory.'/mail.key','x');
                if (!$keyFile) throw new \RuntimeException('Could not create the email encryption key.');
                fwrite($keyFile,random_bytes(32));fclose($keyFile);chmod($directory.'/mail.key',0600);
            }
            $key=file_get_contents($directory.'/mail.key');$iv=random_bytes(12);$tag='';
            $encrypted=openssl_encrypt(json_encode($data,JSON_THROW_ON_ERROR),'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag);
            if ($encrypted===false) throw new \RuntimeException('Could not protect the email settings.');
            $temporary=$directory.'/mail-'.bin2hex(random_bytes(6)).'.tmp';
            $envelope=json_encode(['iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'data'=>base64_encode($encrypted)],JSON_THROW_ON_ERROR);
            if (file_put_contents($temporary,$envelope,LOCK_EX)===false) throw new \RuntimeException('Could not save email settings.');
            chmod($temporary,0600);
            if (!rename($temporary,$directory.'/mail.json')) { @unlink($temporary);throw new \RuntimeException('Could not activate email settings.'); }
        } finally { flock($lock,LOCK_UN);fclose($lock); }
    }
}
