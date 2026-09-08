from pathlib import Path
import json,html,zipfile
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
D=Path(__file__).resolve().parent
old=json.loads((D/'slides.json').read_text())
context=json.loads((D/'narrative-context-notes.json').read_text())
blocks=(D/'narrative.txt').read_text().strip().split('\n---\n')
mapping=[[1,3],[3],[4],[5],[6],[7],[8],[9],[10,11],[12],[13,70],[14],[15],[16,17],[17,18,19],[20],[21],[22],[23],[24,59],[25,26],[27],[28,29],[30,31,70],[32,33],[34],[35],[36,37,60],[38,39],[40,42,43],[41],[44,45,46],[47,52],[48,49,50],[51,64],[53,54,55],[56],[57],[58,59,60,61],[62,71],[63,67,68],[69]]
assert len(mapping)==len(blocks)
chapters=[]
for n,(block,ids) in enumerate(zip(blocks,mapping),1):
 lines=block.splitlines();assert len(lines)==4
 refs=list(dict.fromkeys(ref for i in ids for ref in old[i-1]['sources']))
 chapters.append({'number':n,'title':lines[0],'problem':lines[1],'solution':lines[2],'example':lines[3],'sources':refs,'notes':context.get(str(n),'')+'\n\n'+'\n\n'.join(old[i-1]['notes'] for i in ids)})
(D/'narrative.json').write_text(json.dumps(chapters,ensure_ascii=False,indent=2))
md=['# Volleyra — التطبيق بيقدم إيه، وبيحل أنهي مشاكل وإزاي؟','','النسخة دي مكتوبة كشرح مترابط بالمصري، مش قائمة نقاط. كل جزء بيبدأ بالسياق أو المشكلة، وبعده طريقة عمل الميزة، ثم مثال أو توضيح عملي. الأمثلة افتراضية، والأسعار حسب كود ٨ سبتمبر ٢٠٢٦، ولم يتم التحقق من إعدادات الخدمة الحية.','']
for c in chapters:
 md += [f'## {c["number"]}. {c["title"]}','',c['problem'],'',c['solution'],'',c['example'],'','مرجع المميزات: '+ '، '.join('`'+r+'`' for r in c['sources']), '']
md+=['## ملحق: تفاصيل التنفيذ وحدود الوعود','', 'الملاحظات التالية مرجع للمقدّم ولإعداد شرح دقيق، وليست بديلًا عن الفصول التفسيرية السابقة. بتوضح الفرق بين مميزات موصولة بصفحات، ومكونات غير موصولة، وخدمات تعتمد على إعدادات خارجية.','']
for s in old:
 md += ['### '+s['title'],'',s['notes'],'']
md+=['## الرياضات المدعومة كتصنيفات','','كرة قدم، كرة سلة، كرة يد، كرة طائرة، تنس، سباحة، بادل، اسكواش، تنس طاولة، ريشة طائرة، جمباز، كاراتيه، ملاكمة، ألعاب قوى، كونغ فو، تايكوندو، كروس فت، جودو، كيك بوكسينج، مصارعة، رماية، مبارزة، فروسية، دراجات، رفع أثقال، باركور. وجود التصنيف لا يعني توافر النشاط في كل منطقة.']
(D/'دليل-العرض-وحصر-المميزات.md').write_text('\n'.join(md))
sections=[]
for c in chapters:
 sections.append(f'<article id="chapter-{c["number"]}"><small>الفصل {c["number"]} من {len(chapters)}</small><h2>{html.escape(c["title"])}</h2><p>{html.escape(c["problem"])}</p><p>{html.escape(c["solution"])}</p><aside><p>{html.escape(c["example"])}</p></aside><details><summary>ملاحظات الشرح ومرجع الكود</summary><p>{html.escape(c["notes"])}</p><pre>{html.escape(chr(10).join(c["sources"]))}</pre></details></article>')
(D/'العرض-الكامل.html').write_text('''<!doctype html><html lang="ar-EG" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Volleyra | شرح التطبيق وفايدته</title><style>body{margin:0;background:#081526;color:#eef4fb;font-family:"Noto Sans Arabic",Tahoma,Arial,sans-serif;line-height:2}main,header{max-width:1040px;margin:auto;padding:24px}article{padding:34px;margin:22px 0;background:#10243a;border-radius:18px}p{font-size:21px;margin:20px 0}h2{font-size:30px}small,summary{color:#55dec4}aside{background:#17424b;padding:4px 22px;border-radius:12px}pre{direction:ltr;text-align:left;white-space:pre-wrap;font-size:12px}summary{cursor:pointer}details p{font-size:16px;color:#bac8d7}@media print{body,article{background:white;color:#14273a}article{break-after:page}header{display:none}aside{background:#eee}}</style><header><h1>Volleyra: المميزات والمشاكل اللي بيحلها وإزاي</h1><p>نسخة تفسيرية بالمصري للأعضاء وأصحاب الأكاديميات وأولياء الأمور. ٤٢ فصلًا بشرح ظاهر، وأمثلة، ومراجع.</p></header><main>'''+''.join(sections)+'</main></html>')
r=Presentation();r.slide_width=Inches(16);r.slide_height=Inches(9)
r.core_properties.title='Volleyra | شرح المميزات وفايدتها';r.core_properties.author='Volleyra'
def box(sl,x,y,w,h,text,size=20,color='EDF4FC',bold=False,rtl=True):
 sh=sl.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));tf=sh.text_frame;tf.word_wrap=True
 tf.margin_top=Pt(0);tf.margin_bottom=Pt(0);tf.margin_left=Pt(0);tf.margin_right=Pt(0)
 p=tf.paragraphs[0];p.alignment=PP_ALIGN.RIGHT if rtl else PP_ALIGN.LEFT;p._p.get_or_add_pPr().set('rtl','1' if rtl else '0');p.space_after=Pt(0)
 run=p.add_run();run.text=text;run.font.name='Noto Sans Arabic';run.font.size=Pt(size);run.font.bold=bold;run.font.color.rgb=RGBColor.from_string(color)
 rp=run._r.get_or_add_rPr();rp.set('lang','ar-EG');cs=OxmlElement('a:cs');cs.set('typeface','Noto Sans Arabic');rp.append(cs)
def rect(sl,x,y,w,h,color):
 sh=sl.shapes.add_shape(1, Inches(x),Inches(y),Inches(w),Inches(h));sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string(color);sh.line.fill.background()
for c in chapters:
 sl=r.slides.add_slide(r.slide_layouts[6]);sl.background.fill.solid();sl.background.fill.fore_color.rgb=RGBColor.from_string('081526')
 accent='F1BD61' if 33<=c['number']<=35 else '55DEC4'
 rect(sl,15.7,0,.3,9,accent)
 box(sl,.7,.25,2.8,.5,'VOLLEYRA',18,accent,True)
 box(sl,5,.25,9.4,.5,'التطبيق بيقدم إيه؟ المشكلة، الحل، والفايدة',13,'A9BAD0')
 box(sl,.85,.98,13.7,1.08,c['title'],29,'EDF4FC',True)
 box(sl,.95,2.15,13.6,.35,'السياق والاحتياج',13,accent,True)
 box(sl,.95,2.56,13.6,1.42,c['problem'],20)
 box(sl,.95,4.06,13.6,.35,'التطبيق بيساعد إزاي؟',13,accent,True)
 box(sl,.95,4.46,13.6,1.82,c['solution'],20)
 rect(sl,.75,6.48,13.98,1.66,'153B46')
 box(sl,1,6.63,13.4,.32,'مثال أو توضيح عملي',12,accent,True)
 box(sl,1,7.0,13.4,1.05,c['example'],18)
 box(sl,.85,8.5,2,.28,f'{c["number"]:02d} / {len(chapters)}',11,'A9BAD0',rtl=False)
 box(sl,4,8.47,10.5,.35,'شرح مبني على الكود · سبتمبر ٢٠٢٦ | الأمثلة توضيحية وليست بيانات عملاء',11,'A9BAD0')
 sl.notes_slide.notes_text_frame.text='\n\n'.join([c['problem'],c['solution'],c['example'],c['notes'],'مراجع الكود:\n'+'\n'.join(c['sources'])])
r.save(D/'Volleyra-العرض-التفصيلي.pptx')
print('Narrative slides:',len(chapters),'Narrative words:',sum(len((c['problem']+' '+c['solution']+' '+c['example']).split()) for c in chapters))
