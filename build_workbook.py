from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.chart import LineChart, BarChart, Reference
from openpyxl.utils import get_column_letter
from datetime import date
import math, json

P={'Prix abonnement mensuel':185,'Prix prestation déploiement':997,'Jours travaillés/an':208,'Diagnostics gratuits/semaine':1,'Taux conversion':.5,'Jours/déploiement':2,'Heures/diagnostic':1,'Jours marketing/semaine':1,'Rétention annuelle':.85,'Heures/jour':7,'Salaire mensuel':3400,'Taux net salaire':.9,'Part CA net IR':.5,'Dépenses mensuelles':0,'Jours Naval/semaine':4,'Heures réelles/jour Naval':7,'Heures cérébrales/semaine':35}
wb=Workbook(); ws=wb.active; ws.title='Synthèse'
navy='171719'; blue='0071E3'; pale='F5F5F7'; green='16834B'; thin=Side(style='thin',color='E2E2E7')
def title(ws,cell,text): ws[cell]=text; ws[cell].font=Font(size=20,bold=True,color=navy); ws[cell].fill=PatternFill('solid',fgColor='FFFFFF')
def style_header(row):
    for c in row:
        c.font=Font(bold=True,color='FFFFFF'); c.fill=PatternFill('solid',fgColor=blue); c.alignment=Alignment(horizontal='center'); c.border=Border(bottom=thin)
for sh in wb.worksheets: sh.sheet_view.showGridLines=False
# Parameters
par=wb.create_sheet('Paramètres'); title(par,'A1','Paramètres du modèle — Consultant agent IA v2'); par['A3']='Paramètre'; par['B3']='Valeur'; par['C3']='Unité'; par['D3']='Rôle'; style_header(par[3])
rows=[('Prix abonnement mensuel',185,'€ / client / mois','MRR par client'),('Prix prestation déploiement',997,'€ / déploiement','CA one-shot'),('Jours travaillés/an',208,'jours','Capacité annuelle'),('Diagnostics gratuits/semaine',1,'diagnostics','Acquisition'),('Taux conversion',.5,'%','Diagnostic vers déploiement'),('Jours/déploiement',2,'jours','Charge de production'),('Heures/diagnostic',1,'heures','Charge commerciale'),('Jours marketing/semaine',1,'jours','Prospection'),('Rétention annuelle',.85,'%','Rétention abonnement'),('Heures/jour',7,'heures','Base équivalent jour'),('Salaire mensuel',3400,'€ / mois','Naval Group'),('Taux net salaire',.9,'%','Salaire net IR'),('Part CA net IR',.5,'%','Impôt, cotisations, API, frais'),('Dépenses mensuelles',0,'€ / mois','Charges additionnelles'),('Jours Naval/semaine',4,'jours','1 jour télétravail'),('Heures réelles/jour Naval',7,'heures','Présence réelle'),('Heures cérébrales/semaine',35,'heures','Travail cérébral')]
for i,r in enumerate(rows,4):
    for j,v in enumerate(r,1): par.cell(i,j,v)
    if r[2]=='%': par.cell(i,2).number_format='0.0%'
    elif r[2].startswith('€'): par.cell(i,2).number_format='#,##0.00 [$€-fr-FR]'
for col,w in {'A':31,'B':16,'C':21,'D':32}.items(): par.column_dimensions[col].width=w
par.freeze_panes='A4'
# monthly model
months=[]; y,m=2027,1
while (y,m)<=(2030,1): months.append(f'{m:02d}/{str(y)[-2:]}'); m+=1; y+=m//13; m=(m-1)%12+1
mrr=wb.create_sheet('MRR mensuel'); title(mrr,'A1','MRR mensuel — 01/2027 à 01/2030'); headers=['Mois','Clients actifs','Nouveaux clients','Déploiements','MRR brut','Net IR MRR','CA déploiement','CA total','Net IR consultant','Salaire net IR','Revenu total net IR','Heures business','Jours business équiv.']
for j,h in enumerate(headers,1): mrr.cell(3,j,h)
style_header(mrr[3]); ret=P['Rétention annuelle']**(1/12); new=P['Diagnostics gratuits/semaine']*52/12*P['Taux conversion']; active=0
for i,month in enumerate(months,4):
    active=active*ret+new; deployments=new; mr=active*P['Prix abonnement mensuel']; dep=deployments*P['Prix prestation déploiement']; ca=mr+dep; net=ca*P['Part CA net IR']; sal=P['Salaire mensuel']*P['Taux net salaire']; diag=P['Diagnostics gratuits/semaine']*52/12*P['Heures/diagnostic']; market=P['Jours marketing/semaine']*52/12*P['Heures/jour']; deph=deployments*P['Jours/déploiement']*P['Heures/jour']; hrs=diag+market+deph
    vals=[month,active,new,deployments,mr,mr*P['Part CA net IR'],dep,ca,net,sal,net+sal-P['Dépenses mensuelles'],hrs,hrs/P['Heures/jour']]
    for j,v in enumerate(vals,1): mrr.cell(i,j,v)
    for j in range(2,14): mrr.cell(i,j).number_format='#,##0.00'
for col in range(1,14): mrr.column_dimensions[get_column_letter(col)].width=18
mrr.freeze_panes='A4'; mrr.auto_filter.ref=f'A3:M{3+len(months)}'
# charts
line=LineChart(); line.title='MRR brut'; line.y_axis.title='€'; line.x_axis.title='Mois'; line.add_data(Reference(mrr,min_col=5,min_row=3,max_row=3+len(months)),titles_from_data=True); line.set_categories(Reference(mrr,min_col=1,min_row=4,max_row=3+len(months))); line.height=8; line.width=16; mrr.add_chart(line,'O3')
bar=BarChart(); bar.type='col'; bar.title='CA total & Net IR'; bar.add_data(Reference(mrr,min_col=8,min_row=3,max_col=9,max_row=3+len(months)),titles_from_data=True); bar.set_categories(Reference(mrr,min_col=1,min_row=4,max_row=3+len(months))); bar.height=8; bar.width=16; mrr.add_chart(bar,'O20')
# annual
ann=wb.create_sheet('Synthèse annuelle'); title(ann,'A1','Synthèse annuelle'); ah=['Année','CA consultant + MRR','Net IR consultant','MRR moyen','Heures business','Jours business équiv.','Revenu total net IR']
for j,h in enumerate(ah,1): ann.cell(3,j,h)
style_header(ann[3])
for r,year in enumerate([2027,2028,2029,2030],4):
    idx=[i for i,x in enumerate(months,4) if x.endswith(str(year)[-2:])]
    if not idx: continue
    vals=[year]+[sum(mrr.cell(i,c).value for i in idx) for c in [8,9]]+[sum(mrr.cell(i,5).value for i in idx)/len(idx),sum(mrr.cell(i,12).value for i in idx),sum(mrr.cell(i,13).value for i in idx),sum(mrr.cell(i,11).value for i in idx)]
    for j,v in enumerate(vals,1): ann.cell(r,j,v); ann.cell(r,j).number_format='#,##0.00'
for col in range(1,8): ann.column_dimensions[get_column_letter(col)].width=23
# workforce
work=wb.create_sheet('Temps & capacité'); title(work,'A1','Temps de travail et capacité'); work.append(['Indicateur','Valeur','Unité','Calcul / hypothèse']); style_header(work[2])
wm=[('Jours annuels travaillés',P['Jours travaillés/an'],'jours','Paramètre'),('Heures disponibles à 208 j/an',P['Jours travaillés/an']*P['Heures/jour'],'heures','208 × 7 h'),('Heures hebdo présence Naval',P['Jours Naval/semaine']*P['Heures réelles/jour Naval'],'heures','4 × 7 h'),('Heures hebdo travail cérébral',P['Heures cérébrales/semaine'],'heures','Paramètre'),('Heures annuelles présence Naval',P['Jours travaillés/an']/5*P['Jours Naval/semaine']*P['Heures réelles/jour Naval'],'heures','52 semaines × 4 × 7'),('Heures annuelles travail cérébral',P['Heures cérébrales/semaine']*P['Jours travaillés/an']/5,'heures','35 × 41,6 semaines'),('Jours sur site annuels',P['Jours travaillés/an']/5*P['Jours Naval/semaine'],'jours','1 jour télétravail/semaine'),('Heures réelles / jour Naval Group',P['Heures réelles/jour Naval'],'heures','Paramètre'),('Heures réelles annuelles Naval Group',P['Jours travaillés/an']/5*P['Jours Naval/semaine']*P['Heures réelles/jour Naval'],'heures','Jours sur site × heures/jour'),('Heures annuelles à consacrer à agent IA',sum(mrr.cell(i,12).value for i in range(4,4+len(months)))/3.083,'heures','Charge moyenne annualisée du scénario')]
for r,v in enumerate(wm,3):
    for j,x in enumerate(v,1): work.cell(r,j,x)
for col,w in {'A':40,'B':18,'C':14,'D':44}.items(): work.column_dimensions[col].width=w
# overview
for c,v in {'A3':'Indicateur','B3':'Valeur','C3':'Lecture'}.items(): ws[c]=v
style_header(ws[3]); overview=[('MRR à 01/2030',mrr.cell(4+len(months)-1,5).value,'Revenu récurrent brut fin de période'),('Clients actifs à 01/2030',mrr.cell(4+len(months)-1,2).value,'Base d’abonnés'),('CA cumulé consultant + MRR',sum(mrr.cell(i,8).value for i in range(4,4+len(months))),'Période complète'),('Net IR cumulé consultant',sum(mrr.cell(i,9).value for i in range(4,4+len(months))),'Après taux net paramétrable'),('Revenu total net IR fin de période',mrr.cell(4+len(months)-1,11).value,'Salaire net + consultant - dépenses')]
for r,v in enumerate(overview,4):
    for j,x in enumerate(v,1): ws.cell(r,j,x)
    ws.cell(r,2).number_format='#,##0.00'
for col,w in {'A':38,'B':20,'C':50}.items(): ws.column_dimensions[col].width=w
ws['A11']='Onglets'; ws['A12']='Paramètres'; ws['B12']='Toutes les hypothèses modifiables'; ws['A13']='MRR mensuel'; ws['B13']='Trajectoire mensuelle, CA et graphiques'; ws['A14']='Synthèse annuelle'; ws['B14']='Consolidation par année'; ws['A15']='Temps & capacité'; ws['B15']='Présence Naval Group et temps agent IA'
for sh in wb.worksheets:
    sh.sheet_properties.pageSetUpPr.fitToPage=True
    for row in sh.iter_rows():
        for cell in row:
            if cell.value is not None: cell.alignment=Alignment(vertical='center')
wb.calculation.fullCalcOnLoad=True
wb.calculation.forceFullCalc=True
wb.save('/home/hermes/consultant/Consultant agent IA v2.xlsx')
print(json.dumps({'path':'/home/hermes/consultant/Consultant agent IA v2.xlsx','sheets':wb.sheetnames,'months':len(months)}))
