import {describe,expect,it}from'vitest';
import JSZip from'jszip';
import {pruneUnusedPptxMedia}from'../prune-unused-media';
const rels=(target:string,external=false)=>`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="image" Target="${target}"${external?' TargetMode="External"':''}/></Relationships>`;
describe('PPTX orphan image cleanup',()=>{
 it('preserves slide/master images, encoded/root-relative targets and non-image parts',async()=>{
  const zip=new JSZip();for(const name of ['cover.png','master.png','space name.jpeg','typed name.png','orphan.png'])zip.file('ppt/media/'+name,name);
  zip.file('ppt/media/vector.svg','<svg/>');zip.file('ppt/embeddings/data.xlsx','workbook');
  zip.file('ppt/slides/_rels/slide1.xml.rels',rels('../media/cover.png'));
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',rels('/ppt/media/master.png'));
  zip.file('ppt/slides/_rels/slide2.xml.rels',rels('../media/space%20name.jpeg'));
  zip.file('[Content_Types].xml','<Types><Override PartName="/ppt/media/typed%20name.png" ContentType="image/png"/></Types>');
  await pruneUnusedPptxMedia(zip);expect(zip.file('ppt/media/orphan.png')).toBeNull();
  for(const name of ['cover.png','master.png','space name.jpeg','typed name.png','vector.svg'])expect(zip.file('ppt/media/'+name)).not.toBeNull();
  expect(zip.file('ppt/embeddings/data.xlsx')).not.toBeNull();
 });
 it('ignores external URLs and preserves images when relationship metadata is malformed',async()=>{
  const zip=new JSZip();zip.file('ppt/media/image.png','image');zip.file('ppt/slides/_rels/slide1.xml.rels',rels('https://example.com/image.png',true));
  await pruneUnusedPptxMedia(zip);expect(zip.file('ppt/media/image.png')).not.toBeNull();
  zip.file('ppt/slides/_rels/slide2.xml.rels','<Relationships><broken>');await pruneUnusedPptxMedia(zip);expect(zip.file('ppt/media/image.png')).not.toBeNull();
 });
});
