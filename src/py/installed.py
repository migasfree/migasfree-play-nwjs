from __future__ import print_function
import sys
from migasfree_client.command import MigasFreeCommand
migas=MigasFreeCommand()

pks= str(sys.argv[1])
installed=[]
for pk in pks.split():
    if migas.pms.is_installed(pk):
        if pk not in installed:
            installed.append(pk)

print(' '.join(installed),end='')
