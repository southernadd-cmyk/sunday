#!/usr/bin/env python3
"""Build the original native Construct project and reproducible .c3p package."""
import json, math, random, shutil, zipfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'construct'
for name in ('images','icons','scripts','objectTypes','layouts','eventSheets'):(OUT/name).mkdir(parents=True,exist_ok=True)
next_sid=910000000001
next_uid=1
next_image=18000001
def sid():
 global next_sid
 next_sid+=1
 return next_sid
def write(path,data):
 p=OUT/path
 p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n' if not isinstance(data,str) else data)
def folder(items=None):return {'items':items or [],'subfolders':[]}
def sprite(name,animations):
 global next_image
 items=[]
 for anim,images,origin in animations:
  frames=[]
  for i,image in enumerate(images):
   image.save(OUT/'images'/f'{name.lower()}-{anim.lower()}-{i:03}.png',optimize=True)
   next_image+=1
   frames.append({'width':image.width,'height':image.height,'originX':origin[0],'originY':origin[1],
    'originalSource':'','exportFormat':'lossless','exportQuality':1,'imageSpriteId':next_image,
    'collisionPoly':{'points':[0,0,1,0,1,1,0,1]},'useCollisionPoly':False,'imagePoints':[],'duration':1})
  items.append({'frames':frames,'sid':sid(),'name':anim,'isLooping':True,'isPingPong':False,'repeatCount':1,'repeatTo':0,'speed':0})
 data={'name':name,'plugin-id':'Sprite','sid':sid(),'isGlobal':False,'instanceVariables':[], 'behaviorTypes':[], 'effectTypes':[],'animations':folder(items)}
 write(Path('objectTypes')/(name+'.json'),data)
 return data

def player(team,frame):
 im=Image.new('RGBA',(16,16));d=ImageDraw.Draw(im)
 def rect(x,y,w,h,c):d.rectangle((x,y,x+w-1,y+h-1),fill=c)
 kit=['#e84138','#3866cf','#ead83d','#292e42'][team];step=frame%2
 rect(4,13,8,2,'#12372c');rect(5,1,5,2,'#bc7a32' if team==1 else '#382720')
 rect(4,3,7,3,'#f5c38b');rect(6,5,4,2,'#d99b6a');rect(4,7,7,4,kit)
 rect(3,7+step,1,3,'#f5c38b');rect(11,8-step,1,3,'#f5c38b');rect(5,7,1,3,'#f5f3d7' if team==0 else kit)
 rect(5,11,6,2,'#faf6dd' if team==0 else '#e9e9dc');rect(5,13,2,1 if step else 2,kit);rect(9,13,2,2 if step else 1,kit)
 rect(4,14 if step else 15,3,1,'#1d2933');rect(9,15 if step else 14,3,1,'#1d2933')
 return im

def pitch():
 im=Image.new('RGBA',(528,660),'#286c37');d=ImageDraw.Draw(im);rng=random.Random(71)
 def xy(x,z):return ((x+44)*6,(z+55)*6)
 def box(x,z,w,h,c):
  a,b=xy(x,z);d.rectangle((int(a),int(b),int(a+w*6),int(b+h*6)),fill=c)
 for i in range(12):box(-34,-51+i*8.5,68,8.5,'#409a3b' if i%2==0 else '#398e36')
 for _ in range(5200):
  x=rng.randrange(60,468);y=rng.randrange(24,637);d.point((x,y),fill=rng.choice(['#65a947','#3b8c33','#4f9b38']))
 def rect(x,z,w,h):
  a,b=xy(x,z);d.rectangle((round(a),round(b),round(a+w*6),round(b+h*6)),outline='#edf2cb',width=2)
 def line(x,z,xx,zz,col='#edf2cb',width=2):d.line([xy(x,z),xy(xx,zz)],fill=col,width=width)
 rect(-34,-47,68,94);line(-34,0,34,0)
 c=xy(0,0);d.ellipse((c[0]-55,c[1]-55,c[0]+55,c[1]+55),outline='#edf2cb',width=2)
 for sign in (-1,1):
  z=-47 if sign==-1 else 29;rect(-20,z,40,18);rect(-9,-47 if sign==-1 else 41,18,6)
  cx,cy=xy(0,sign*35);d.rectangle((cx-1,cy-1,cx+1,cy+1),fill='#fff9cf')
  z=-51 if sign==-1 else 47
  box(-6.1,z,12.2,4,'#779b75');rect(-6.1,z,12.2,4)
  for x in range(-5,6):line(x,z,x,z+4,'#c1d1ad',1)
  for k in range(1,4):line(-6.1,z+k,6.1,z+k,'#c1d1ad',1)
 for side in (-1,1):
  for j in range(15):
   x=side*(39+rng.randrange(0,3));z=-44+j*6+rng.randrange(-1,2);cx,cy=xy(x,z)
   coat=['#d0b67c','#6867a9','#dddcd0','#e35841','#467ca4'][j%5]
   d.rectangle((cx-2,cy-9,cx+3,cy-5),fill='#e7b488');d.rectangle((cx-4,cy-4,cx+4,cy+3),fill=coat)
   d.rectangle((cx-3,cy+4,cx-1,cy+8),fill='#263443');d.rectangle((cx+1,cy+4,cx+3,cy+8),fill='#263443')
 return im

def gear(kind):
 im=Image.new('RGBA',(24,24));d=ImageDraw.Draw(im)
 d.ellipse((2,17,22,22),fill='#23482c')
 if kind=='boots':d.rectangle((7,4,12,15),fill='#2a3444');d.rectangle((5,13,19,17),fill='#f1eab9');d.rectangle((4,17,19,19),fill='#1a2230')
 elif kind=='orange':d.ellipse((5,5,19,19),fill='#ef9c36');d.rectangle((10,2,12,5),fill='#84b359')
 elif kind=='shirt':d.polygon([(7,4),(17,4),(22,8),(18,12),(16,9),(16,20),(8,20),(8,9),(5,12),(2,8)],fill='#e84138');d.rectangle((9,7,11,14),fill='#fff1cc')
 elif kind=='watch':d.rectangle((9,0,14,23),fill='#914e35');d.ellipse((4,5,20,21),fill='#fff0ad');d.ellipse((7,8,17,18),fill='#243747');d.line((12,10,12,14,16,14),fill='#fff0ad',width=2)
 elif kind=='tape':d.rectangle((4,6,19,19),fill='#f4e6b0');d.rectangle((9,9,14,16),fill='#b79b63')
 else:d.ellipse((5,4,20,19),fill='#fff1cb');d.rectangle((10,9,15,14),fill='#243747')
 return im

objects=[]
def add_sprite(name,anims):objects.append(name);return sprite(name,anims)
add_sprite('Pitch',[('Default',[pitch()],(0,0))])
add_sprite('Footballer',[(name,[player(i,0),player(i,1)],(.5,.94)) for i,name in enumerate(['Home','Away','Keeper','Official'])])
ball=Image.new('RGBA',(8,8));bd=ImageDraw.Draw(ball);bd.rectangle((1,1,6,6),fill='#fff8d6');bd.rectangle((3,3,5,4),fill='#243747');bd.point((1,1),fill='#c2c2a9')
add_sprite('Ball',[('Default',[ball],(.5,.5))])
ring=Image.new('RGBA',(40,24));ImageDraw.Draw(ring).ellipse((1,1,38,22),outline='#ffdf59',width=2)
add_sprite('StrikerRing',[('Default',[ring],(.5,.5))])
add_sprite('Ghost',[('Default',[player(0,0)],(.5,.94))])
add_sprite('Pickup',[(name,[gear(name)],(.5,.8)) for name in ['boots','orange','shirt','ball','watch','tape']])
for name,plugin in [('Plans','DrawingCanvas'),('HudCanvas','DrawingCanvas'),('Label','Text')]:
 objects.append(name);write(Path('objectTypes')/(name+'.json'),{'name':name,'plugin-id':plugin,'sid':sid(),'isGlobal':False,'instanceVariables':[],'behaviorTypes':[],'effectTypes':[]})

layers=[]
def layer(name,transparent):
 data={'name':name,'overriden':0,'subLayers':[],'instances':[],'sid':sid(),'effectTypes':[],'isInitiallyVisible':True,'isInitiallyInteractive':True,'color':[1,1,1,1],'backgroundColor':[.13,.33,.19,1],'isTransparent':transparent,'parallaxX':1,'parallaxY':1,'scaleRate':1,'forceOwnTexture':False,'renderingMode':'2d','drawOrder':'z-order','useRenderCells':False,'blendMode':'normal','zElevation':0,'global':False}
 layers.append(data);return data
field=layer('Pitch',False);hud=layer('HUD',True)
def instance(layer,name,x,y,w,h,origin=(.5,.5),frame=0,animation='Default',text=''):
 global next_uid
 props={'initially-visible':True,'initial-animation':animation,'initial-frame':frame,'enable-collisions':False,'live-preview':False}
 if name in ['Plans','HudCanvas']:props={'initially-visible':True,'origin':'top-left','antialiasing':'off'}
 if name=='Label':props={'text':text,'enable-bbcode':False,'font':'Courier New','size':12,'line-height':0,'bold':True,'italic':False,'color':[.97,.96,.82,1],'horizontal-alignment':'left','vertical-alignment':'top','wrapping':'word','initially-visible':True,'origin':'top-left'}
 entry={'type':name,'properties':props,'uid':next_uid,'instanceVariables':{},'behaviors':{},'world':{'x':x,'y':y,'width':w,'height':h,'originX':origin[0],'originY':origin[1],'color':[1,1,1,1],'angle':0,'zElevation':0}}
 layer['instances'].append(entry);next_uid+=1
instance(field,'Pitch',40,-22,880,1100,(0,0))
instance(field,'Plans',0,0,960,640,(0,0))
instance(field,'StrikerRing',370,480,48,29)
# Editor-visible first-attack positions. The shared engine supplies subsequent layouts.
actors=[(-11,0,0),(-21,-22,0),(20,-24,0),(7,-1,0),(-22,16,0),(24,20,0),(1,30,0),(-3,-21,1),(10,-29,1),(-15,-33,1),(13,19,1),(-23,25,1),(0,31,1),(25,24,1),(0,-45,2),(0,45,2),(-29,-2,3),(44,16,3),(44,23,0),(-44,-17,3)]
for x,z,team in actors:instance(field,'Footballer',480+x*10,58+(z+49)*8.4,32,32,(.5,.94),animation=['Home','Away','Keeper','Official'][team])
instance(field,'Ball',375,462,9,9)
instance(field,'Ghost',-100,-100,32,32,(.5,.94))
for i in range(3):instance(field,'Pickup',-100-i*30,-100,28,28,(.5,.8))
instance(hud,'HudCanvas',0,0,960,640,(0,0))
instance(hud,'Label',20,16,310,88,(0,0),text='SUNDAY\nANCHOR & CROWN  0\nTHE RAILWAY ARMS  0')
layout={'name':'Saltmere','layers':layers,'sid':sid(),'nonworld-instances':[],'effectTypes':[],'width':960,'height':1280,'unboundedScrolling':True,'vpX':0.5,'vpY':0.5,'projection':'orthographic','eventSheet':'Match'}
write(Path('layouts')/'Saltmere.json',layout)
write(Path('eventSheets')/'Match.json',{'name':'Match','sid':sid(),'events':[{'eventType':'comment','text':'SUNDAY — THE NEXT TWO SECONDS\nNative Construct sprites and Drawing Canvas overlays. Match rules: scripts/engine.js. Input, UI and playback: scripts/controller.js.\nDouble-click Footballer in the Project Bar to edit original pixel animations. The first attack is laid out here; the engine supplies the following attacks.'}]})
rootfiles={k:folder() for k in ('script','sound','music','video','font','icon','general')}
for name,purpose in [('main.js','main'),('controller.js','none'),('engine.js','none')]:rootfiles['script']['items'].append({'name':name,'type':'application/javascript','sid':sid(),'script-info':{'purpose':purpose}})
for n in (16,32,64,128,256,512):
 icon=Image.new('RGBA',(32,32),'#172640');di=ImageDraw.Draw(icon);di.rectangle((4,3,27,28),outline='#ffdf59',width=2);di.ellipse((10,9,23,22),fill='#fff1cb');di.rectangle((15,13,19,17),fill='#172640');icon.resize((n,n),Image.Resampling.NEAREST).save(OUT/'icons'/f'icon-{n}.png')
 rootfiles['icon']['items'].append({'name':f'icon-{n}.png','type':'image/png','sid':sid(),'icon-info':{'purpose':'app-icon'}})
project={'projectFormatVersion':1,'savedWithRelease':44000,'name':'SUNDAY — The Next Two Seconds','runtime':'c3','useWorker':'no','bundleAddons':False,
 'usedAddons':[{'type':'plugin','id':p,'name':n,'author':'Scirra','version':'r440','bundled':False} for p,n in [('Sprite','Sprite'),('DrawingCanvas','Drawing Canvas'),('Text','Text')]],
 'uniqueId':'sunday-saltmere-c3-001','objectTypes':folder(objects),'autosaveData':None,'containers':[],'families':folder(),'layouts':folder(['Saltmere']),'eventSheets':folder(['Match']),'rootFileFolders':rootfiles,'timelines':folder(),
 'properties':{'description':'A Sunday league roguelite played on a full-screen pixel pitch. Freeze, pass, plot a run, and play the next two seconds.','version':'0.3.0.0','author':'Adam Clement','authorEmail':'','authorWebsite':'https://southernadd-cmyk.github.io/sunday/','appId':'uk.saltmere.sunday','pixelRounding':True,'zAxisScale':'normalized','fov':math.pi/4,'useLoaderLayout':False,'fullscreenMode':'scale-outer','fullscreenQuality':'low','viewportFit':'auto','backgroundColor':[.13,.33,.19,1],'splashColor':[.09,.15,.25,1],'useThemeColor':True,'themeColor':[.09,.15,.25,1],'orientations':'any','webgpu':'auto','gpuPreference':'low-power','scriptsType':'module','framerateMode':'vsync','compositingMode':'standard','sampling':'nearest','downscaling':'low','renderingMode':'auto','anisotropicFiltering':'auto','maxSpriteSheetSize':2048,'loaderStyle':'splash','preloadSounds':False,'autoReloadScriptsOnPreview':False,'exportFileStructure':'folders'},'viewportWidth':960,'viewportHeight':640,'firstLayout':'Saltmere'}
write(Path('project.c3proj'),project)
shutil.copyfile(ROOT/'src'/'engine.js',OUT/'scripts'/'engine.js')
if not (OUT/'scripts'/'main.js').exists():raise SystemExit('Write construct/scripts/main.js before packaging')
archive=ROOT/'public'/'downloads'/'SUNDAY-Construct3.c3p';archive.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(OUT.rglob('*')):
  if p.is_file() and p.suffix not in ('.md',):
   info=zipfile.ZipInfo(p.relative_to(OUT).as_posix(),date_time=(2026,11,25,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
   z.writestr(info,p.read_bytes())
shared=Path('/workspace/shared');shared.mkdir(parents=True,exist_ok=True);shutil.copyfile(archive,shared/archive.name)
print(f'Construct project: {len(objects)} native object types, 2 layers, {len(list(OUT.rglob("*.png")))} original PNG assets')
print(f'{archive}: {archive.stat().st_size} bytes')
