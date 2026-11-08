"""Build index.html from template: inline logo + timetable snapshot."""
import base64,sys,json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
tpl=(root/'src/index.template.html').read_text()
logo='data:image/webp;base64,'+base64.b64encode((root/'assets/kjst-logo.webp').read_bytes()).decode()
snap=(root/'data/timetable.json').read_text()
api=(root/'config/api_url.txt').read_text().strip() if (root/'config/api_url.txt').exists() else ''
def build(default_teacher, full_doc, variant='a', switcher=False):
    sw='<div class="hd-switch" role="group" aria-label="เลือกแบบส่วนหัว"><span>แบบส่วนหัว</span><button type="button" data-v="a">A แถบกรมท่า</button><button type="button" data-v="b">B พื้นสว่าง</button><button type="button" data-v="c">C กึ่งกลาง</button></div>' if switcher else ''
    h=tpl.replace('__SWITCHER__',sw).replace('__HEADER_VARIANT__',variant)
    h=h.replace('__LOGO__',logo).replace('__SNAPSHOT__',snap).replace('__API_URL__',api).replace('__DEFAULT_TEACHER__',default_teacher)
    if full_doc:
        h='<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+h.replace('<style>','<style>\n:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\nbody{margin:0}img{max-width:100%}[hidden]{display:none!important}',1)
        h=h.replace('</style>\n','</style>\n</head>\n<body>\n',1)+'\n</body>\n</html>\n'
    return h
(root/'index.html').write_text(build('',True))
pv=root/'preview'; pv.mkdir(exist_ok=True)
(pv/'kjst-portal.html').write_text(build('นายธนพันธ์ เพ็งสวัสดิ์',False,'a',False))
print('ok', len((root/'index.html').read_text().encode()))
