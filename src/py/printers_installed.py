from __future__ import print_function
import cups

try:
    conn = cups.Connection()
except RuntimeError:
    conn = None

installed = []
if conn:  # cups is running
    printers = conn.getPrinters()

    for printer in printers:
        p=printers[printer]
        if len(p['printer-info'].split('__')) == 5:
            installed.append(int(p['printer-info'].split('__')[4]))

print(installed,end='')

