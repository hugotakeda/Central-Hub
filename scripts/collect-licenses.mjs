import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
function notices(folder) {
  return readdirSync(folder,{withFileTypes:true}).filter(f=>f.isFile()&&/^(?:licen[cs]e|copying|copyright|notice)(?:[.-]|$)/i.test(f.name)).map(f=>({name:f.name,text:readFileSync(join(folder,f.name),'utf8')}));
}
let js='# Avisos de licença das dependências JavaScript de produção\n\n';
for(const [path,entry] of Object.entries(lock.packages)){
  if(!path||entry.dev||!existsSync(join(root,path,'package.json')))continue;
  const p=JSON.parse(readFileSync(join(root,path,'package.json'),'utf8'));
  js+=`\n${'='.repeat(72)}\n${p.name} ${p.version} — ${typeof p.license==='string'?p.license:'consulte os avisos'}\n`;
  const files=notices(join(root,path));
  if(!files.length)throw new Error(`Nenhuma licença encontrada para ${p.name}`);
  for(const file of files)js+=`\n--- ${file.name} ---\n${file.text}\n`;
}
mkdirSync(join(root,'public/licenses'),{recursive:true});
writeFileSync(join(root,'public/licenses/DEPENDENCIAS.txt'),js);
const cargo=JSON.parse(execFileSync('cargo',['metadata','--manifest-path',join(root,'src-tauri/Cargo.toml'),'--format-version','1','--locked'],{encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true}));
const packages=cargo.packages.filter(p=>p.source);
let native='# Avisos de licença das dependências Rust\n\n';
for(const p of packages){
  native+=`\n${'='.repeat(72)}\n${p.name} ${p.version} — ${p.license??'consulte os avisos'}\n`;
  for(const file of notices(dirname(p.manifest_path)))native+=`\n--- ${file.name} ---\n${file.text}\n`;
}
writeFileSync(join(root,'public/licenses/NATIVAS.txt'),native);
writeFileSync(join(root,'docs/LICENCAS-NATIVAS.json'),JSON.stringify(packages.map(p=>({nome:p.name,versao:p.version,licenca:p.license,origem:p.source})),null,2)+'\n');
writeFileSync(join(root,'public/licenses/CENTRAL-HUB.txt'),readFileSync(join(root,'LICENSE'),'utf8'));
writeFileSync(join(root,'public/licenses/CREDITOS.md'),readFileSync(join(root,'THIRD_PARTY_NOTICES.md'),'utf8'));
console.log(JSON.stringify({bibliotecasNativas:packages.length,avisosJavaScriptBytes:Buffer.byteLength(js),avisosNativosBytes:Buffer.byteLength(native)}));
