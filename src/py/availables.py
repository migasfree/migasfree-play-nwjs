from __future__ import print_function
import os
import urllib2
from migasfree_client.client import MigasFreeClient
from migasfree_client import settings

pms=str(MigasFreeClient().pms)
migasfree_conf=settings.CONF_FILE
if pms == "apt-get":
    _err = os.system("apt-cache pkgnames")
elif pms == "yum":
    _err = os.system("yum --quiet list available|awk -F. 'print $1'|grep -v '^ ' |sed '1d'")
elif pms == "zypper":
    _err = os.system("zypper pa|awk -F'|' '{print $3}'")
elif pms == "gpkgmgr":
    f_repos=os.path.join(os.environ["ProgramFiles"],'Gpkgmanrepo','repow.list')
    repos=open(f_repos, 'r').read()
    for repo in repos.split("\r\n"):
        if repo:
            repo=''.join(repo.splitlines()[0])
            response = urllib2.urlopen(repo+'/metadata')
            #response.info()
            metadata = response.read()
            for pkg in metadata.splitlines():
               if pkg:
                   print(pkg[:-4],end='')

else:
    pass

