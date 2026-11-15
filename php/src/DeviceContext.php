<?php
declare(strict_types=1);
namespace ReGen;

final class DeviceContext
{
    public static function fromUserAgent(string $agent): array
    {
        $browser='Unknown browser';$version='';
        foreach (['Opera'=>'/(?:OPR|Opera)\/([\d.]+)/','Microsoft Edge'=>'/Edg(?:A|iOS)?\/([\d.]+)/','Samsung Internet'=>'/SamsungBrowser\/([\d.]+)/','Mozilla Firefox'=>'/(?:Firefox|FxiOS)\/([\d.]+)/','Google Chrome'=>'/(?:Chrome|CriOS)\/([\d.]+)/','Safari'=>'/Version\/([\d.]+).*Safari/'] as $name=>$pattern) {
            if(preg_match($pattern,$agent,$match)){$browser=$name;$version=$match[1];break;}
        }
        $device='Unknown device';$os='Unknown platform';$osVersion='';
        if(preg_match('/(?:iPhone|iPad|iPod).*?(?:OS ([\d_]+))?/',$agent,$match)){
            $device=str_contains($agent,'iPad')?'iPad':'iPhone';$os='iOS';
            if(preg_match('/OS ([\d_]+)/',$agent,$match))$osVersion=str_replace('_','.',$match[1]);
        }elseif(str_contains($agent,'Android')){
            $device=str_contains($agent,'Mobile')?'Android phone':'Android tablet';$os='Android';
            if(preg_match('/Android ([\d.]+)/',$agent,$match))$osVersion=$match[1];
        }elseif(str_contains($agent,'Windows')){
            $device='Windows computer';$os='Windows';
            if(preg_match('/Windows NT ([\d.]+)/',$agent,$match))$osVersion='NT '.$match[1];
        }elseif(str_contains($agent,'Macintosh')){
            $device=str_contains($agent,'Mobile')?'iPad':'Mac computer';$os=$device==='iPad'?'iPadOS':'macOS';
            if(preg_match('/Mac OS X ([\d_]+)/',$agent,$match))$osVersion=str_replace('_','.',$match[1]);
        }elseif(str_contains($agent,'Linux')){$device='Linux computer';$os='Linux';}
        return ['browser'=>$browser,'browserVersion'=>mb_substr($version,0,30),'device'=>$device,'operatingSystem'=>$os,'osVersion'=>mb_substr($osVersion,0,30)];
    }

    public static function capture(array $client=[]): array
    {
        $result=self::fromUserAgent((string)($_SERVER['HTTP_USER_AGENT']??''));
        $result['requestId']=(string)($_SERVER['REGEN_REQUEST_ID']??'');
        $result['language']=mb_substr(preg_replace('/[^a-zA-Z0-9,;= .-]/','',(string)($_SERVER['HTTP_ACCEPT_LANGUAGE']??'')),0,80);
        if(in_array($client['page']??'',['/dashboard','/builder','/profile','/support','/notifications','/feedback','/cover-letters','/templates'],true))$result['page']=$client['page'];
        if(in_array($client['displayMode']??'',['browser','standalone'],true))$result['displayMode']=$client['displayMode'];
        if(isset($client['timezone'])&&is_string($client['timezone'])&&in_array($client['timezone'],\DateTimeZone::listIdentifiers(),true))$result['timezone']=$client['timezone'];
        foreach(['width','height'] as $key){$value=filter_var($client[$key]??null,FILTER_VALIDATE_INT);if($value!==false&&$value>=200&&$value<=16000)$result[$key]=$value;}
        return $result;
    }
}
