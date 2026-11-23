// Run locally with sharp installed, or set REGEN_NODE_MODULES to the bundled package directory.
// Template sources are 1588 px PNGs rendered from the real public sample PDFs.
import {createRequire} from 'node:module';
import {mkdir, stat, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require(process.env.REGEN_NODE_MODULES ? path.join(process.env.REGEN_NODE_MODULES, 'sharp') : 'sharp');
const source = path.resolve(process.argv[2] || path.join(root, 'tmp/pdfs/template-previews'));
const destination = path.join(root, 'public/img/templates');
await mkdir(destination, {recursive:true});
const {templates}=JSON.parse(await readFile(path.join(root,'public/samples/catalog.json'),'utf8'));
for (const {id} of templates) {
  for (const width of [320,640,1280]) {
    const input = path.join(source,id+'.png');
    const size = await sharp(input).metadata();
    if (size.width < 1280 || size.height / size.width > 1.42) throw new Error('Expected a high-resolution, single-page A4 capture: '+id);
    await sharp(input).resize(width,Math.round(width*297/210)).webp({lossless:true,effort:6})
      .toFile(path.join(destination,`${id}-${width}.webp`));
  }
}
// Lossless encoding preserves transparency in the responsive wordmarks.
for (const width of [116,232,348]) {
  await sharp(path.join(root,'public/img/brand-wordmark.png')).resize(width)
    .webp({lossless:true,effort:6}).toFile(path.join(root,`public/img/brand-wordmark-${width}.webp`));
}
const before = (await stat(path.join(root,'public/img/brand-wordmark.png'))).size;
const after = (await stat(path.join(root,'public/img/brand-wordmark-348.webp'))).size;
console.log(`Wordmark source and largest responsive variant: ${before} → ${after} bytes. Generated ${templates.length*3} responsive template previews.`);
