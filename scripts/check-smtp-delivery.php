<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/vendor/autoload.php';
if(($argv[1]??'')==='--client'){
    $mailer=new ReGen\SmtpMailer('127.0.0.1',(int)$argv[2],'qa-user','fixture-password','none',5);
    try{$ok=$mailer->send('support@regen.local','ReGen','fixture@regen.local','Permohonan diterima ✓',"Fixture body\r\n.leading dot",['From: ReGen <support@regen.local>']);echo $ok?'accepted':'failed';}
    catch(ReGen\MailDeliveryUncertain){echo 'uncertain';}
    catch(ReGen\MailDeliveryRejected){echo 'rejected';}
    catch(Throwable){echo 'failed';}
    exit;
}
$assertions=0;
foreach(['accepted','uncertain','rejected','transient'] as $outcome){
    $server=stream_socket_server('tcp://127.0.0.1:0',$error,$message);
    if(!$server)throw new RuntimeException('Cannot start isolated SMTP fixture.');
    $address=stream_socket_get_name($server,false);$port=(int)substr($address,strrpos($address,':')+1);
    $pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'--client',(string)$port],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(!is_resource($process))throw new RuntimeException('Cannot start SMTP test client.');
    $peer=stream_socket_accept($server,10);if(!$peer)throw new RuntimeException('SMTP test client did not connect.');stream_set_timeout($peer,5);
    fwrite($peer,"220 localhost ESMTP fixture\r\n");
    $steps=[['EHLO ',"250-localhost\r\n250 AUTH LOGIN\r\n"],['AUTH LOGIN',"334 VXNlcm5hbWU6\r\n"],[base64_encode('qa-user'),"334 UGFzc3dvcmQ6\r\n"],[base64_encode('fixture-password'),"235 Authenticated\r\n"],['MAIL FROM:',"250 Sender accepted\r\n"],['RCPT TO:',"250 Recipient accepted\r\n"],['DATA',"354 Send message\r\n"]];
    foreach($steps as [$prefix,$reply]){$line=fgets($peer);if(!is_string($line)||!str_starts_with($line,$prefix))throw new RuntimeException('SMTP protocol fixture failed.');fwrite($peer,$reply);}
    $wire='';while(($line=fgets($peer))!==false){if(rtrim($line,"\r\n")==='.')break;$wire.=$line;}
    preg_match('/^Subject: ([^\r\n]*(?:\r\n[\t ][^\r\n]*)*)/m',$wire,$subject);
    $rawSubject=$subject[1]??'';$decoded=iconv_mime_decode($rawSubject,ICONV_MIME_DECODE_CONTINUE_ON_ERROR,'UTF-8');
    if($decoded!=='Permohonan diterima ✓'||preg_match('/[^\x00-\x7f]/',$rawSubject)||!str_contains($wire,"\r\n..leading dot"))throw new RuntimeException('SMTP must encode Unicode subjects and dot-stuff message bodies.');$assertions++;
    if($outcome==='accepted')fwrite($peer,"250 Message accepted\r\n");
    if($outcome==='rejected')fwrite($peer,"550 Message rejected\r\n");
    if($outcome==='transient')fwrite($peer,"451 Try again later\r\n");
    fclose($peer);fclose($server);
    $result=trim(stream_get_contents($pipes[1]));$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);
    $expected=$outcome==='transient'?'failed':$outcome;
    if($exit!==0||$result!==$expected)throw new RuntimeException('SMTP outcome incorrect: '.$outcome.' / '.$result);$assertions++;
}
echo "SMTP acceptance, permanent rejection, temporary deferral, lost acknowledgement, Unicode and dot-stuffing checks passed ($assertions assertions; localhost fixture, no external email).\n";
