import json, os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

home=os.path.expanduser('~')
with open(os.path.join(home,'.hermes/google_token.json')) as f:
    token=json.load(f)
creds=Credentials(token.get('token') or token.get('access_token'), refresh_token=token['refresh_token'], token_uri=token['token_uri'], client_id=token['client_id'], client_secret=token['client_secret'], scopes=token.get('scopes'))
drive=build('drive','v3',credentials=creds)
folder_name='#Consultant + MRR'
folders=drive.files().list(q="name = '#Consultant + MRR' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", spaces='drive', fields='files(id,name)', pageSize=10).execute().get('files',[])
if not folders:
    folder=drive.files().create(body={'name':folder_name,'mimeType':'application/vnd.google-apps.folder'}, fields='id,name').execute()
else:
    folder=folders[0]
name='Consultant agent IA — Business plan v2.html'
q="name = 'Consultant agent IA — Business plan v2.html' and trashed = false"
existing=drive.files().list(q=q, spaces='drive', fields='files(id,name,parents,webViewLink,modifiedTime)', pageSize=20).execute().get('files',[])
media=MediaFileUpload('/home/hermes/consultant/index.html', mimetype='text/html', resumable=False)
parents=','.join(folder.get('id') for _ in [0])
if existing:
    f=drive.files().update(fileId=existing[0]['id'], media_body=media, body={'name':name}, fields='id,name,mimeType,webViewLink,modifiedTime').execute()
    action='updated'
else:
    f=drive.files().create(body={'name':name,'parents':[folder['id'],''] if False else [folder['id']]}, media_body=media, fields='id,name,mimeType,webViewLink,modifiedTime').execute()
    action='created'
print(json.dumps({'action':action,'folder_id':folder['id'],'file':f}, ensure_ascii=False))
