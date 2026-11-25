from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'public'/'art'
out.mkdir(parents=True,exist_ok=True)
for kit in ('home','away','keeper'):
 for i in range(2):
  name=f'footballer-{kit}-{i:03}.png'
  shutil.copyfile(root/'construct'/'images'/name,out/name)
