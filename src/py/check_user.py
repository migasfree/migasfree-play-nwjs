import platform
import sys

user=str(sys.argv[1])
password=str(sys.argv[2])


if platform.system() == "Windows":
    import os
    import getpass
    import win32security
    import ctypes
    domain=os.environ['userdomain']
    try:
      hUser = win32security.LogonUser (
        user,
        domain,
        password,
        win32security.LOGON32_LOGON_NETWORK,
        win32security.LOGON32_PROVIDER_DEFAULT
      )
    except win32security.error:
        exit(1)
    else:
        if ctypes.windll.shell32.IsUserAnAdmin() == 1:  # is a admin
            print "OK"
            exit(0)
        else:
            exit(1)

elif platform.system() == "Linux":

    import crypt
    import re

    def auth(user,password):
        hand = open('/etc/shadow','r')
        for line in hand:     
            x = re.findall('^%s:' % user, line)
            if len(x) > 0 : 
                salt = line.split(":")[1]
                if crypt.crypt(password, salt) == salt:
                    return True
        return False
                
                
    def is_sudo_group(user):
        hand = open('/etc/group','r')
        for line in hand:           
            x = re.findall('^sudo:', line)  
            if len(x) > 0 :  
                for element in line.split(":")[3].split(","):
                    element=element.replace("\n","")
                    if element == user:
                        return True
        return False
        
    def is_root(user):
        hand = open('/etc/passwd','r')
        for line in hand:           
            x = re.findall('^%s:' % user, line) 
            if len(x) > 0 :       
                if line.split(":")[2]=="0":
                    return True
        return False

    if auth(user,password) and (is_sudo_group(user) or is_root(user)) :
        print "OK"
        exit(0)
    else: 
        exit(1)
    
    
    
    
    
