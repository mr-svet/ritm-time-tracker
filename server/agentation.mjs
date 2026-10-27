// Opt-in visual feedback. This cookie grants no journal or API permissions.
export function feedbackPage({html,policy,url,cookie='',secure=false,owner=false}){
 if(!owner)return {html,policy,setCookie:null};
 const name=secure?'__Host-ritm_feedback':'ritm_feedback';
 const choice=url.searchParams.get('agentation');
 const enabled=choice==='1'||(choice!=='0'&&cookie.split(';').some(part=>part.trim()===name+'=1'));
 const setCookie=choice==='1'||choice==='0'
  ?`${name}=${choice==='1'?'1':'0'}; Path=/; HttpOnly; SameSite=Strict${secure?'; Secure':''}`:null;
 if(!enabled)return {html,policy,setCookie};
 const connection=policy.match(/connect-src[^;]*/)?.[0];
 policy=policy.replace(connection,connection.replace("'none'","'self'").trim()+' http://localhost:4747');
 html=html.replace('</body>','<script type="module" src="/agentation/panel.mjs"></script>\n</body>');
 return {html,policy,setCookie};
}
