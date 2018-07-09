import sys
import platform

if __name__ == '__main__':
    user = str(sys.argv[1])
    password = str(sys.argv[2])

    if platform.system() == "Windows":
        import os
        import win32security
        import ctypes

        domain = os.environ['userdomain']
        try:
            hUser = win32security.LogonUser(
                user,
                domain,
                password,
                win32security.LOGON32_LOGON_NETWORK,
                win32security.LOGON32_PROVIDER_DEFAULT
            )
        except win32security.error:
            sys.exit(1)
        else:
            if ctypes.windll.shell32.IsUserAnAdmin() == 1:  # is an admin
                print "OK"
                sys.exit(0)
            else:
                sys.exit(1)

    elif platform.system() == "Linux":
        import crypt
        import re

        def auth(user_, password_):
            hand = open('/etc/shadow')
            for line in hand:
                x = re.findall('^%s:' % user_, line)
                if len(x) > 0:
                    salt = line.split(":")[1]
                    if crypt.crypt(password_, salt) == salt:
                        return True

            return False

        def is_sudo_group(user_):
            hand = open('/etc/group')
            for line in hand:
                x = re.findall('^sudo:', line)
                if len(x) > 0:
                    for element in line.split(":")[3].split(","):
                        element = element.replace("\n", "")
                        if element == user_:
                            return True

            return False

        def is_root(user_):
            hand = open('/etc/passwd')
            for line in hand:
                x = re.findall('^%s:' % user_, line)
                if len(x) > 0:
                    if line.split(":")[2] == "0":
                        return True

            return False

        if auth(user, password) and (is_sudo_group(user) or is_root(user)):
            print "OK"
            sys.exit(0)
        else:
            sys.exit(1)
