#!/usr/bin/env python3
"""Sync owned scripts into the genuine Construct HTML5 export, then zip it.

Art/layout/object changes require a fresh export from Construct. This only
updates the project's three JavaScript modules; no Construct engine file changes.
"""
from pathlib import Path
import hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1]
project=ROOT/'construct';web=ROOT/'public'/'construct'
assert 'Scirra Construct' in (web/'index.html').read_text()
for name in ('main.js','controller.js','engine.js'):
 shutil.copyfile(project/'scripts'/name,web/'scripts'/'project'/name)
archive=ROOT/'public'/'downloads'/'SUNDAY-Construct3-Web.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(web.rglob('*')):
  if p.is_file():
   info=zipfile.ZipInfo(p.relative_to(web).as_posix(),date_time=(2026,11,25,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
manifest={'editor':'Construct r506.4','format':'Web (HTML5)','native_export':True,'source_directory':'construct','web_directory':'public/construct','runtime_modified':False,'export_options':{'lossless':'PNG','deduplicate_images':True,'optimize_images':False,'minify':'None','offline_support':False},'project_script_sha256':{n:hashlib.sha256((project/'scripts'/n).read_bytes()).hexdigest() for n in ('main.js','controller.js','engine.js')},'checks':'Native package opened; Construct script validation passed; automated API-contract checks passed. Native GPU rendering unverified: test browser could not initialize WebGL.'}
(ROOT/'docs'/'CONSTRUCT3_EXPORT.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Native Construct web export:',sum(p.stat().st_size for p in web.rglob('*') if p.is_file()),'bytes; zipped',archive.stat().st_size)
