"""Build data/timetable.json from a text export of the "KJST Substitute Teaching" database
(sheets: Timetable, Teachers, Duty, Items, Requests, Settings).
Leave reasons, request types and attachments are never copied (PDPA)."""
import sys,csv,io,json,datetime
src=sys.argv[1]
t=open(src,encoding='utf-8').read()
P={}
for blk in t.split('## Sheet name: ')[1:]:
    n,_,b=blk.partition('\n'); P[n.strip()]=list(csv.reader(io.StringIO(b.strip('\n'))))
def recs(name):
    rows=P[name]; h=rows[0]; return [dict(zip(h,r)) for r in rows[1:] if any(r)]
S={r['key']:r['value'] for r in recs('Settings')}
meta=json.loads(S.get('TT_META','{}'))
dept={r['teacher'].strip():r['dept'].strip() for r in recs('Teachers') if r['teacher'].strip()}
tt=[r for r in recs('Timetable') if r['teacher'].strip()]
teachers=sorted(set(dept)|{r['teacher'].strip() for r in tt})
ix={n:i for i,n in enumerate(teachers)}
rows=[[ix[r['teacher'].strip()],int(r['day'])+1,int(r['period']),r['code'],r['subject'],r['class']] for r in tt]
duty=[[ix[r['teacher'].strip()],int(r['day'])+1,int(r['period']),r['label']] for r in recs('Duty') if r['teacher'].strip() in ix]
req={r['id']:r for r in recs('Requests')}
items=[]
for r in recs('Items'):
    q=req.get(r['request_id'],{})
    if q.get('status') in ('cancelled','canceled','deleted','rejected') or 'ยกเลิก' in r.get('request_status',''): continue
    items.append({k:v for k,v in {
      'd':r['date'],'p':int(r['period']),'a':r['teacher'],'code':r['code'],'s':r['subject'],'c':r['class'],
      'm':r['method'],'ml':r['method_label'],'by':r['sub_teacher'],'sw':r['swap_teacher'],
      'sd':r['swap_date'],'sp':int(r['swap_period']) if r['swap_period'] else None,'ss':r['swap_subject'],
      'st':r['request_status'],'ack':r['ack']}.items() if v not in ('',None)})
items.sort(key=lambda x:(x['d'],x['p']))
class_away=[]
if 'ClassAway' in P:
    for r in recs('ClassAway'):
        if r.get('status','active')!='active' or not r.get('date'): continue
        class_away.append({'d':r['date'],'cls':[c.strip() for c in r['classes'].split(',') if c.strip()],
          'ps':[int(x) for x in r.get('periods','').replace(' ','').split(',') if x.isdigit()],'note':r.get('reason','')})
out={'updated':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).isoformat(timespec='minutes'),
 'source':'snapshot',
 'term':{'name':S.get('TERM_NAME',''),'start':S.get('TERM_START',''),'end':S.get('TERM_END',''),'holidays':[x for x in S.get('HOLIDAYS','').split(',') if x]},
 'times':meta.get('times',[]),'noCover':meta.get('noCover',[]),'activity':meta.get('activity',[]),
 'teachers':teachers,'groups':{n:dept.get(n,'อื่นๆ') for n in teachers},'rows':rows,'duty':duty,'items':items,'classAway':class_away}
json.dump(out,open('data/timetable.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(teachers),len(rows),len(duty),len(items),out['term'])
