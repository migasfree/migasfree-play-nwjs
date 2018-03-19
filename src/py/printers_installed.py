from __future__ import print_function

import platform

if __name__ == '__main__':
    OS = platform.system()

    if OS == "Linux":
        import cups
        try:
            conn = cups.Connection()
        except RuntimeError:
            conn = None

        installed = []
        if conn:
            printers = conn.getPrinters()

            for printer in printers:
                p = printers[printer]
                if len(p['printer-info'].split('__')) == 5:
                    installed.append(int(p['printer-info'].split('__')[4]))

        print(installed, end='')
    elif OS == "Windows":
        from migasfree_client.devices import LocalDevice

        installed = []
        local_devices = LocalDevice()

        for key in local_devices.printers:
            installed.append(key)

        print(installed, end='')
