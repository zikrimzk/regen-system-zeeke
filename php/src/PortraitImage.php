<?php
declare(strict_types=1);
namespace ReGen;

final class PortraitImage
{
    private const MAX_PIXELS=20000000;
    private const MAX_SIDE=1600;

    private static function decode(string $bytes): ?\GdImage
    {
        $info=@getimagesizefromstring($bytes);
        if(!$info||$info[0]*$info[1]>self::MAX_PIXELS||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG],true))return null;
        $image=@imagecreatefromstring($bytes);
        if(!$image)return null;
        $scale=min(1,self::MAX_SIDE/max($info[0],$info[1]));
        if($scale<1)$image=self::resample($image,(int)max(1,round($info[0]*$scale)),(int)max(1,round($info[1]*$scale)),0,0,$info[0],$info[1]);
        if($info[2]!==IMAGETYPE_JPEG||!function_exists('exif_read_data'))return $image;

        $stream=fopen('php://memory','w+b');
        fwrite($stream,$bytes);
        rewind($stream);
        $orientation=(int)(@exif_read_data($stream,'IFD0')['Orientation']??1);
        fclose($stream);
        if(in_array($orientation,[2,5,7],true))imageflip($image,IMG_FLIP_HORIZONTAL);
        if($orientation===4)imageflip($image,IMG_FLIP_VERTICAL);
        $degrees=match($orientation){3=>180,5,8=>90,6,7=>-90,default=>0};
        if(!$degrees)return $image;
        $rotated=imagerotate($image,$degrees,0);
        return $rotated?:$image;
    }

    /** Normalize orientation and remove metadata without sending the portrait off site. */
    public static function upload(string $bytes): array
    {
        $source=self::decode($bytes);
        if(!$source)throw new \DomainException('Choose a valid JPG or PNG photo.');
        $width=imagesx($source);
        $height=imagesy($source);
        $image=self::resample($source,$width,$height,0,0,$width,$height);
        $encoded=self::jpeg($image,95);
        if(strlen($encoded)>1450*1024)$encoded=self::jpeg($image,90);
        return ['photoBase64'=>'data:image/jpeg;base64,'.base64_encode($encoded),'width'=>imagesx($image),'height'=>imagesy($image)];
    }

    public static function crop(string $data,bool $square,string $focus): string
    {
        if(strlen($data)>8*1024*1024||!preg_match('#^data:image/(?:png|jpe?g);base64,([a-zA-Z0-9+/=\r\n]+)$#D',$data,$match))return '';
        $bytes=base64_decode($match[1],true);
        $source=$bytes===false?null:self::decode($bytes);
        if(!$source)return '';
        $ratio=$square?1:.75;
        $cropWidth=min(imagesx($source),(int)floor(imagesy($source)*$ratio));
        if($cropWidth<1)return '';
        $cropHeight=min(imagesy($source),(int)round($cropWidth/$ratio));
        $width=min(720,$cropWidth);
        $height=max(1,(int)round($width/$ratio));
        $vertical=match($focus){'bottom'=>1,'center'=>.5,default=>.15};
        $image=self::resample($source,$width,$height,(int)((imagesx($source)-$cropWidth)/2),(int)((imagesy($source)-$cropHeight)*$vertical),$cropWidth,$cropHeight);
        return 'data:image/jpeg;base64,'.base64_encode(self::jpeg($image,94));
    }

    private static function resample(\GdImage $source,int $width,int $height,int $x,int $y,int $cropWidth,int $cropHeight): \GdImage
    {
        $image=imagecreatetruecolor($width,$height);
        imagefill($image,0,0,imagecolorallocate($image,255,255,255));
        imagecopyresampled($image,$source,0,0,$x,$y,$width,$height,$cropWidth,$cropHeight);
        return $image;
    }

    private static function jpeg(\GdImage $image,int $quality): string
    {
        ob_start();
        imagejpeg($image,null,$quality);
        return (string)ob_get_clean();
    }
}
