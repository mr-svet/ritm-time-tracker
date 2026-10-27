// Run explicitly by the owner on their Mac. Never started by npm start or deploy.
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {backupDatabase} from './backup.mjs';
import {snapshotHash,inspectSnapshot} from './install-snapshot.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const host=process.argv[2],app=process.argv[3];
const key=join(root,'keys/rhythm-hetzner-ed25519');
const run=(cmd,args,options={})=>{
 const result=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,...options});
 if(result.error||result.status!==0)throw new Error(result.stderr?.trim()||result.error?.message||`${cmd} failed.`);
 return result.stdout.trim();
};
const sshOptions=['-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','-i',key];
const remote=(script,args=[])=>run('ssh',[...sshOptions,'root@'+host,'bash','-se','--',...args],{input:script});
const importContainerOptions='--rm --network none --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --security-opt no-new-privileges:true';

async function main(){
 process.umask(0o077);
 if(process.platform!=='darwin'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(host??'')||!/^[a-z0-9][a-z0-9-]{2,80}$/.test(app??''))throw new Error('Run on your Mac: node tools/migrate-to-dokploy.mjs SERVER_IPV4 COMPOSE_APP_NAME');
 if(!existsSync(key)||!existsSync(join(root,'data/rhythm.sqlite')))throw new Error('Local SSH key or SQLite database not found.');
 const container=app+'-rhythm-1',volume=app+'_rhythm-data',backups=app+'_rhythm-backups';
 // Read-only checks before stopping anything; no host-key trust bypass.
 remote(`set -eu
test "$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$1")" = "$2"
test "$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$1")" = rhythm
test "$(docker inspect -f '{{.Config.User}}' "$1")" = node
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$1")" = "$3"
docker volume inspect "$4" >/dev/null
`,[container,app,volume,backups]);

 const id='migration-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
 const stage='/root/rhythm-'+id;
 remote('set -eu\numask 077\nmkdir -m 700 "$1"\n',[stage]);
 run('scp',[...sshOptions,join(root,'tools/install-snapshot.mjs'),join(root,'tools/verify-import-container.mjs'),'root@'+host+':'+stage+'/']);
 // Exercise the same Node image, Linux capabilities and cross-owner copy
 // before stopping the local app or transferring any private database.
 console.log(remote(`set -eu
image=$(docker inspect -f '{{.Image}}' "$1")
docker run ${importContainerOptions} \\
 --tmpfs /data:rw,noexec,nosuid,size=32m,mode=700,uid=1000,gid=1000 \\
 --tmpfs /backups:rw,noexec,nosuid,size=32m,mode=700,uid=1000,gid=1000 \\
 --tmpfs /source:rw,noexec,nosuid,size=32m,mode=700 \\
 --mount "type=bind,source=$2,target=/import,readonly" \\
 --entrypoint node "$image" /import/verify-import-container.mjs
`,[container,stage]));

 const listeners=spawnSync('lsof',['-nP','-iTCP:4173','-sTCP:LISTEN','-t'],{encoding:'utf8'});
 if(listeners.error||![0,1].includes(listeners.status))throw new Error('Cannot check the local server.');
 const pids=[...new Set((listeners.stdout??'').trim().split(/\s+/).filter(Boolean).map(Number))];
 for(const pid of pids){
  const cwd=run('lsof',['-a','-p',String(pid),'-d','cwd','-Fn']).split('\n').find(s=>s.startsWith('n'))?.slice(1);
  const command=run('ps',['-p',String(pid),'-o','command=']);
  if(cwd!==root.replace(/\/$/,'')||!/(^|\/)node\s+(?:--env-file-if-exists=\.env\s+)?server\/start\.mjs$/.test(command))throw new Error('Port 4173 belongs to another process. Stop the local Rhythm server yourself and retry.');
 }
 for(const pid of pids)process.kill(pid,'SIGTERM');
 const until=Date.now()+60000;
 while(pids.some(pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}})){
  if(Date.now()>until)throw new Error('Local server has not stopped; no database was transferred.');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 console.log('Local Rhythm stopped. Keep it stopped after migration.');
 const directory=join(root,'backups',id);mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 const snapshot=join(directory,'rhythm.sqlite');
 await backupDatabase(join(root,'data/rhythm.sqlite'),snapshot);
 const db=new DatabaseSync(snapshot);
 try{db.exec('PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE; DELETE FROM sessions; DELETE FROM links; COMMIT; VACUUM;');}finally{db.close();}
 chmodSync(snapshot,0o600);
 const summary=inspectSnapshot(snapshot),hash=snapshotHash(snapshot);
 if(summary.tables.account!==1||summary.tables.journal!==1)throw new Error('Owner account or journal missing in local snapshot.');
 run('scp',[...sshOptions,snapshot,'root@'+host+':'+stage+'/']);
 // Only this compose container and its two named volumes are touched.
 const output=remote(`set -eu
container="$1"; volume="$2"; backups="$3"; stage="$4"; archive="$5"; checksum="$6"
image=$(docker inspect -f '{{.Image}}' "$container")
docker stop --time 45 "$container" >/dev/null
docker run ${importContainerOptions} \\
 --mount "type=volume,source=$volume,target=/data" \\
 --mount "type=volume,source=$backups,target=/backups" \\
 --mount "type=bind,source=$stage,target=/import,readonly" \\
 --entrypoint node "$image" /import/install-snapshot.mjs "$archive" "$checksum"
docker start "$container" >/dev/null
rm -- "$stage/rhythm.sqlite" "$stage/install-snapshot.mjs" "$stage/verify-import-container.mjs"
rmdir -- "$stage"
for attempt in $(seq 1 45); do
 status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
 if [ "$status" = healthy ]; then echo RHYTHM_MIGRATION_OK; exit 0; fi
 sleep 2
done
echo 'Import completed, but container health needs checking in Dokploy.' >&2
exit 1
`,[container,volume,backups,stage,id,hash]);
 console.log(output);
 console.log('Original database preserved. Private transfer copy: '+snapshot);
 console.log('Next: save the existing bot token in Dokploy Environment, then deploy once. Do not start the local bot.');
}

main().catch(error=>{console.error('Migration stopped: '+error.message+'\nKeep existing copies. Do not restart two bots. Check Dokploy before retrying.');process.exitCode=1;});
