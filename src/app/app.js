"use strict";



var gui = require('nw.gui');
var path = require('path');
var win = gui.Window.get();
var confFile = 'settings.json';
var consoleLog = path.join(gui.__dirname, 'console.log');
var jqxhr;



(function() {
    document.onkeydown = function (e) {
        if (e.keyCode === 116) {  // F5
            e.preventDefault();
            location.reload();
            return false;
        }
        if (e.keyCode === 123) {  // F12
            e.preventDefault();
            gui.Window.get().showDevTools();
            return false;
        }
    }
})();

$(window).bind('resize', function () {
    try {
        resizeTerminal();
    }
    catch(err) {}
});

gui.Window.get().on('close', function(){
    exit();
    gui.App.quit();
});

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

function ready() {
    var fs = require('fs');

    getGlobalData();
    win.show();
    win.minimize();

    if (global.sync) {

        // delete file console.out
        fs.unlinkSync(consoleLog);

        if (global.settings["showalways"]) {
            win.show();
        }
        showSync();
        sync();
    } else {

        fs.stat(consoleLog, function(err, stat) {
            if(err == null) {
                // consoleLog exists
                global.TERMINAL.add(fs.readFileSync(consoleLog, 'utf8'));
            }
        });

        win.show();
        showApps();
    }

    $('#menu-console').click(showSync);
    $('#menu-apps').click(showApps);
    $('#menu-printers').click(showPrinters);
    $('#menu-label').click(showLabel);
    $('#menu-settings').click(showSettings);
}

function runAsUserSync(cmd) {
    var execSync = require('child_process').execSync;
    if (getOS()=="Linux") {
        cmd=replaceAll(cmd, '"' ,'\\\"' );
        execSync('sudo su -c "' + cmd + '" ' + global.user );
    } else if (getOS()=="Windows") {
        execSync(cmd);
    }
}

function runAsUser(cmd) {
    var exec = require('child_process').exec;
    if (getOS()=="Linux") {
        cmd=replaceAll(cmd, '"' ,'\\\"' );
        exec('sudo su -c "' + cmd + '" ' + global.user );
    } else if (getOS()=="Windows") {
        exec(cmd);
    }
}


function supportExternalLinks(event) {

    var href;
    var isExternal = false;

    function crawlDom(element) {
        if (element.nodeName.toLowerCase() === 'a') {
            href = element.getAttribute('href');
        }
        if (element.classList.contains('js-external-link')) {
            isExternal = true;
        }
        if (href && isExternal) {
            event.preventDefault();
            var data = {
                "server": global.server,
                "cid":  global.label["id"],
                "computer": global.label["name"],
                "project": global.project,
                "uuid": global.uuid
            }
            href = Mustache.render(href,data);
            var script= 'python -c "import webbrowser;webbrowser.open(\'' + href + '\')"';
            runAsUser(script);

        } else if (element.parentElement) {

            crawlDom(element.parentElement);
        }
    }

    crawlDom(event.target);
}


function tooltip(id, text) {
    var anchor = $(id);
    anchor.attr('data-tooltip', text);
    anchor.attr('delay', 100);
    anchor.attr('position', "bottom");
    anchor.tooltip();
}


function getGlobalData() {
    var myArgs = gui.App.argv;
    var execSync = require('child_process').execSync;
    var fs = require('fs');
    var path = require('path');

    readSettings();

    global.TERMINAL = (function() {
        if (typeof global.terminal == 'undefined') {
            global.terminal = "";
        }
        var running = false;
        var stderr = "";

        function addToStdErr(txt) {
            stderr += txt;
        }

        return {
            add: function(txt) {
                try{
                    global.terminal = replaceColors(global.terminal + txt);
                    this.refresh();
                }
                 catch(err) {
                     // NOTHING
                 }
            },
            refresh: function() {
                 try{
                    $('#console-output').html(global.terminal);
                    var x = document.getElementById("console-output");
                    x.scrollTop = x.scrollHeight;
                 }
                 catch(err) {
                     // NOTHING
                 }
            },
            run: function(cmd, beforeCallback=null, afterCallback=null, id) {
                if (running) {
                    Materialize.toast('<i class="material-icons">warning</i>  '+ " please wait, other process is running!!!" , 10000, 'rounded red');
                }
                else{
                    running = true;

                    $("#" + id).addClass("blink");

                    if (beforeCallback) {
                        beforeCallback();
                    }

                    var spawn = require('child_process').spawn;

                    if (getOS()=="Linux") {
                        var process = spawn("bash", ["-c", cmd]);
                    } else if (getOS()=="Windows") {
                        var process = spawn("cmd", ["/C", cmd]);
                    }

                    this.add('<h3># ' + cmd + '</h3>');

                    var date = new Date();
                    var n = date.toDateString();
                    var time = date.toLocaleTimeString();

                    global.TERMINAL.add('<h5>'+date+"</h5>");

                    process.stdout.on('data', function(data) {global.TERMINAL.add(data.toString())});

                    process.stderr.on('data', function(data) {
                        addToStdErr(data.toString());
                        global.TERMINAL.add('<span class="red">' + data.toString() + '</span>');
                    });

                    // when the spawn child process exits, check if there were any errors
                    process.on('exit', function(code) {
                        if (code != 0) { // Syntax error
                            Materialize.toast(
                                '<i class="material-icons">error</i> error:' + code + ' ' + cmd ,
                                10000,
                                'rounded red'
                            );
                            win.show();
                        }
                        else {
                            if (stderr == "") {
                                if (afterCallback) {
                                    afterCallback();
                                }

                                if (id == "sync" &&  document.hidden) {  // sync ok & minimized -> exit
                                    exit();
                                }
                            }
                            else {
                                Materialize.toast(
                                    '<i class="material-icons">error</i>' + replaceColors(stderr),
                                    10000,
                                    'rounded red'
                                );
                                stderr = "";
                            }
                        }

                        global.TERMINAL.add('<hr />');

                        $("#" + id).removeClass("blink");
                        running = false;
                    });
                }
            }
        };
    })();
    if (typeof global.sync == 'undefined') {
        global.sync = (myArgs == "sync")
    }
    if (typeof global.token == 'undefined') {
        var tokenfile =  path.join(process.cwd(),"token");
        if (fs.existsSync(tokenfile)) {
            global.token = 'token ' + fs.readFileSync(tokenfile, 'utf8');
        } else {
            swal({
                title: 'Error',
                type: "error",
                html: "Token not found in file: <b>" + tokenfile + "</b>",
                focusConfirm: true,
                showCancelButton: false
                }
            );
        }
    }
    if (typeof global.conf == 'undefined') {
        global.conf=execSync('python -c "from __future__ import print_function;from migasfree_client import settings;print(settings.CONF_FILE,end=\'\')"')
    }
    if (typeof global.server == 'undefined') {
        global.server=execSync('python -c "from __future__ import print_function;from migasfree_client.utils import get_config;print(get_config(\''+global.conf+'\',\'client\').get(\'server\',\'localhost\'),end=\'\')"');
    }
    if (typeof global.uuid == 'undefined') {
        global.uuid=execSync('python -c "from __future__ import print_function;from migasfree_client.utils import get_hardware_uuid;print(get_hardware_uuid(),end=\'\')"');
    }
    if (typeof global.project == 'undefined') {
        global.project=execSync('python -c "from __future__ import print_function;from migasfree_client.utils import get_mfc_project;print(get_mfc_project(),end=\'\')"');
    }
    if (typeof global.computername == 'undefined') {
        global.computername=execSync('python -c "from __future__ import print_function;from migasfree_client.utils import get_mfc_computer_name;print(get_mfc_computer_name(),end=\'\')"');
    }
    if (typeof global.network == 'undefined') {
        global.network=execSync('python -c "from __future__ import print_function;from migasfree_client.network import get_iface_net, get_iface_cidr, get_ifname;_ifname = get_ifname();print(\'%s/%s\' % (get_iface_net(_ifname), get_iface_cidr(_ifname)),end=\'\')"');
    }
    if (typeof global.mask == 'undefined') {
        global.mask=execSync('python -c "from __future__ import print_function;from migasfree_client.network import get_iface_mask, get_ifname;_ifname = get_ifname();print(get_iface_mask(_ifname),end=\'\')"');
    }
    if (typeof global.ip== 'undefined') {
        global.ip=execSync('python -c "from __future__ import print_function;from migasfree_client.network import get_iface_address, get_ifname;_ifname = get_ifname();print(get_iface_address(_ifname),end=\'\')"');
    }
    if (typeof global.user == 'undefined') {
        global.user=execSync('python -c "from __future__ import print_function;from migasfree_client import utils;_graphic_pid, _graphic_process = utils.get_graphic_pid();print(utils.get_graphic_user(_graphic_pid),end=\'\')"')
    }
    if (typeof global.label== 'undefined') {
        // LABEL
        var url = "http://" + global.server + "/get_computer_info/?uuid=" + global.uuid
        $.getJSON( url, {}).done(function( data ) {
            global.label = data;
            global.cid = global.label["id"];
            getAttributeCID();
            labelDone();
        });
    } else {
        labelDone();
    }


    if (typeof global.category== 'undefined') {
        global.category = 0;
    }
    if (typeof global.level== 'undefined') {
        global.level = "";
    }
    if (typeof global.search== 'undefined') {
        global.search = "";
    }

    if (typeof global.pks_availables== 'undefined') {
        global.pks_availables = getPkgNames();
    }

}

function labelDone() {
    if (typeof global.label != 'undefined') {
        $('#machine').html("<a class='js-external-link' href='http://{{server}}/admin/server/computer/{{cid}}/change/'>"+global.label["name"])+"</a>";
        tooltip("#machine", global.server);

        var typeNumber = 4;
        var errorCorrectionLevel = 'L';
        var qr = qrcode(typeNumber, errorCorrectionLevel);
        qr.addData('{"model":"Computer","id":' + global.label["id"] + ',"server":"' + global.label["server"] + '"}');
        qr.make();

        global.qr = qr;
    }
}

function showSync() {
    var fs = require('fs');
    $('#container').html(fs.readFileSync('templates/sync.html', 'utf8'));
    resizeTerminal();
    global.TERMINAL.refresh();
    $('#sync').click(sync);
}


function resizeTerminal() {
    scroll(0, 0);
    $("#console-output").height(
        $(window).height() - $("#footer-bar").height() - $("#menu-bar").height() - 80
    );
}


function replaceColors(txt) {
    txt = replaceAll(txt, '\u001b[92m','<span style="color:green;font-weight:bold;">');
    txt = replaceAll(txt, '\u001b[93m','<span style="color:yellow";>');
    txt = replaceAll(txt, '\u001b[91m','<span style="color:red;font-weight:bold;">');
    txt = replaceAll(txt, '\u001b[32m','<span style="color:green;">');
    txt = replaceAll(txt, '\u001b[0m','</span>');
    txt = txt.replace(/(?:\r\n|\r|\n)/g, '<br>');
    return txt;
}


function exit() {
    var fs = require('fs');
    fs.writeFile(consoleLog, global.terminal, function(err) {
        if (err) throw err;
    });

    win.close();
}


function beforeSync() {
    Materialize.toast("synchronizing...", 10000, 'rounded grey');
    presync();
}

function afterSync() {
    postsync();
    global.pks_availables = getPkgNames();
    Materialize.toast(
        '<i class="material-icons">sync</i> '+ " synchronized",
        10000,
        'rounded green'
    );
}


function sync(){
    global.TERMINAL.run("migasfree -u", beforeSync, afterSync, "sync");
}


// PRINTERS
function showPrinters() {
    var fs = require('fs');
    global.devs = installedDevs();

    $('#container').html(fs.readFileSync('templates/printers.html', 'utf8'));
    spinner('printers');
    queryPrinters();
    $('#searchPrint').val(global.searchPrint);
    $('#searchPrint').bind('keydown', getCharPrint);
    $('#searchPrint').focus();
}

function queryPrinters() {
    $('#printers').html('');
    $('#preload-next').show();

    var url = "http://" + global.server + "/api/v1/token/devices/logical/";

    spinner('preload-next');
    queryPrintersPage(url);
}


function queryPrintersPage(url) {
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: addTokenHeader,
        data: {},
        success: function (data) {
            showPrinterItem(data);
            if (data.next) {
                var options = [{
                    selector: 'footer',
                    offset: 0,
                    callback: function() {
                        if (data.next) {
                            queryPrintersPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $('#preload-next').hide();
            }
        },
        error: function (jqXHR, textStatus, errorThrown) { swal('Error:' + jqXHR.responseText);},
    });
}


function getDevice(logicaldev) {

    var url = 'http://' + global.server + '/api/v1/token/devices/devices/' + logicaldev.device.id + '/'
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: addTokenHeader,
        data: {},
        success: function (dev) {
            $("#printers").append(renderPrinter(logicaldev, dev));
            updateStatusPrinter(
                logicaldev.device.name+logicaldev.feature.name,
                logicaldev.id
            );

        },
        error: function (jqXHR, textStatus, errorThrown) { swal('Error:' + jqXHR.responseText);},
    });

}



function showPrinterItem(data) {
    $.each(data.results, function(i, item) {
        if (item.device.name.search( RegExp(global.searchPrint, "i")) >=0 ) {
            getDevice(item)
        }
    });
    $('.collapsible').collapsible();  // FIXME
}

function addTokenHeader(xhr) {
     xhr.setRequestHeader('authorization', global.token);
}


function getAttributeCID() {
    var url = 'http://' + global.server + '/api/v1/token/attributes/'
    if (typeof global.label=='string') {
		$.ajax({
			url: url,
			type: 'GET',
			beforeSend: addTokenHeader,
			data: {"property_att__prefix": "CID", "value": global.cid},
			success: function (data) {
				if (data.count==1) {
					global.att_cid = data.results[0].id;
				}
			},
			error: function (jqXHR, textStatus, errorThrown) { swal('Error:' + jqXHR.responseText);},
		});
    }
}

function changeAttributesPrinter(element, id, atts) {
    var url = 'http://' + global.server + '/api/v1/token/devices/logical/' + id + '/';
    $.ajax({
        url : url,
        type : 'PATCH',
        beforeSend: addTokenHeader,
        contentType : 'application/json',
        data: JSON.stringify({"attributes": atts}),
        success: function (data) {
           global.TERMINAL.run(
                "migasfree -u",
                null,
                function() {
                    showPrinters();
                },
                element
           );
        },
        error: function (jqXHR, textStatus, errorThrown) { swal('changeAttributesPrinter Error:' + jqXHR.responseText);},
    });
}


function installPrinter(element, id) {
    var url = 'http://' + global.server + '/api/v1/token/devices/logical/' + id +'/';
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: addTokenHeader,
        data: {},
        success: function (data) {
            var atts =  data.attributes;
            atts.push(global.att_cid);
            changeAttributesPrinter(element, id, atts);
        },
        error: function (jqXHR, textStatus, errorThrown) { swal('Error:' + jqXHR.responseText);},
    });

}

function uninstallPrinter(element, id) {
    var url = 'http://' + global.server + '/api/v1/token/devices/logical/' + id +'/';
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: addTokenHeader,
        data: {},
        success: function (data) {

            var atts =  data.attributes;
            //delete attribute from array
            var index = atts.indexOf(global.att_cid);
            if (index > -1) {
                atts.splice(index, 1);
            }

            changeAttributesPrinter(element, id, atts);
        },
        error: function (jqXHR, textStatus, errorThrown) { swal('Error:' + jqXHR.responseText);},
    });
}


function updateStatusPrinter(name, id) {
    var slug = replaceAll(name, " ", "");
    var el = '#action-' + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;

    var installed = ($.inArray(id,global.devs)>=0);

    try {
        if (installed) { // INSTALLED
            $(el).text('delete');
            $(el).off("click");
            $(el).click(function() {uninstallPrinter('action-' + slug, id);});
//            tooltip(el, "delete device");
            $(status).text("check_circle");
            tooltip(status, "installed");
        } else { // UNINSTALLED
            $(el).text('get_app');
            $(el).off("click");
            $(el).click(function() {installPrinter('action-' + slug, id);});
//            tooltip(el, "install device");
            $(status).text("");
        }

    }
    catch (err){
        //alert("ERROR AQUI: "+err);
    }
}



function renderDict(data) {
    var ret=""
    for(var element in data) {
        ret+= element + ": " + data[element]+"<br>";
    }
    return ret;
}


function renderInfoPrinter(data) {
    return renderDict(JSON.parse(data));
}


function renderPrinter(logicaldev, dev) {
    var fs = require('fs');

    if (dev.connection.name=="TCP") {
        var icon = "assets/printer-net.png";
    } else {
        var icon = "assets/printer-local.png";
    }

    var data = {
        name: logicaldev.device.name + " " + logicaldev.feature.name,
        idaction: "action-" + replaceAll(logicaldev.device.name + logicaldev.feature.name, " ", ""),
        icon: icon,
        description: dev.model.name + " (" + dev.connection.name + ")" + "<hr>" + renderInfoPrinter(dev.data),
        truncated:  dev.model.name + " (" + dev.connection.name + ")"
    };

    return Mustache.to_html(fs.readFileSync('templates/printer.html', 'utf8'), data);
}



// APPS
function showApps() {
    var fs = require('fs');
    queryCategories();
    $('#container').html(fs.readFileSync('templates/apps.html', 'utf8'));
    spinner('apps');
    queryApps();
    showLevels();
    $('#levels').change(changedLevel);
    $('#categories').change(changedCategory);
    $('#search').val(global.search);
    $('#search').bind('keydown', getChar);
    $('#search').focus();
}


function queryCategories() {
    var url="http://" + global.server + "/api/v1/public/catalog/apps/categories/";
    $.getJSON(url, {})
        .done(function(data) {
           global.categories = data;
           global.categories[0] = "All";
           showCategories(global.categories);
           //console.log(global.categories);
        })
        .fail(function(jqxhr, textStatus, error) {
            var err = textStatus + ", " + error;
            alert( "Request Failed: " + err );
        });
}

function queryApps() {
    $('#apps').html('');
    $('#preload-next').show();
    global.packages = "";

    var categoryFilter=""
    if (global.category != 0) {
        categoryFilter="&category=" + global.category
    }

    var url = "http://" + global.server + "/api/v1/public/catalog/apps/" +
        "?packages_by_project__project__name=" + global.project +
        "&level=" + global.level +
        categoryFilter +
        "&ordering=-score,name";

    spinner('preload-next');
    queryAppsPage(url);
}

function queryAppsPage(url) {

    if (jqxhr) jqxhr.abort();
    jqxhr = $.getJSON(url, {})
        .done(function(data) {
            $.each(data.results, function(i, item) {
                $.each(item.packages_by_project, function(i, pkgs) {
                    if (pkgs.project.name == global.project) {
                        global.packages += " " + pkgs.packages_to_install.join(" ");
                    }
                });
           });

            global.packagesInstalled = installedPkgs(global.packages);

            showAppItem(data);

            if (data.next) {
                var options = [{
                    selector: 'footer',
                    offset: 0,
                    callback: function() {
                        if (data.next) {
                            queryAppsPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $('#preload-next').hide();
            }

        });

}

function showAppItem(data) {
    $.each(data.results, function(i, item) {
        if (item.category.id == global.category || global.category == 0) {
            if (item.level.id == global.level || global.level == "")  {
                if (item.name.search( RegExp(global.search, "i")) >=0 || item.description.search( RegExp(global.search, "i")) >=0 ) {
                    $.each(item.packages_by_project, function(i, pkgs) {
                        if (pkgs.project.name == global.project) {
                            $("#apps").append(renderApp(item));
                            updateStatus(
                                item.name,
                                pkgs.packages_to_install.join(" "),
                                item.level.id
                            );
                        }
                    });
                }
            }
        }
    });
    $('.collapsible').collapsible();  // FIXME
}

function showDescription(id) {
    $("#trunc-"+id).hide();
    $("#descr-"+id).show();
}

function showTruncated(id) {
    $("#descr-"+id).hide();
    $("#trunc-"+id).show();
}

function showLevels() {
    var levels = {'': 'All', 'U': 'User', 'A': 'Administrator'}
    $.each(levels, function(key, value) {
        $('#levels')
          .append($('<option>', { value : key })
          .text(value)
        );
    });
    $('#levels').val(global.level);
    $('#levels').material_select();
}

function showCategories(categories) {
    $.each(categories, function(key, value) {
        $('#categories').append(
            $('<option>', {value: key}).text(value)
        );
    });
    $('#categories').val(global.category);
    $('#categories').material_select();

}

function changedCategory() {
    global.category = $('#categories').val();
    //showAppItem();
    queryApps();
}

function changedLevel() {
    global.level = $('#levels').val();
    //showAppItem();
    queryApps();
}


function getChar(event){
    var keyCode = ('which' in event) ? event.which : event.keyCode;
    if (keyCode == 13) {  // Enter
        global.search = $('#search').val();
        //showApps();
        queryApps();
    }
}

function getCharPrint(event){
    var keyCode = ('which' in event) ? event.which : event.keyCode;
    if (keyCode == 13) {  // Enter
        global.searchPrint = $('#searchPrint').val();
        queryPrinters();
    }
}




function updateStatus(name, packages_to_install, level) {
    var slug = replaceAll(name, " ", "");
    var el = '#action-' + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;
    if (packages_to_install == "") {
        installed = false;
    } else {
        var installed = (packages_to_install.split(" ").diff(global.packagesInstalled).length == 0)
    }
    try {
        if (packages_to_install.split(" ").diff(global.pks_availables) == "") { // AVAILABLE
            var person = "";
            if ($('#auth').text() == "" && level=="A") { // NO LOGIN
                if (installed) {
                    $(el).text('person');
                    $(el).off("click");
                    $(el).click(function() {modalLogin(name, packages_to_install, level);});
                    tooltip(el, "login to delete " + name);
                    $(status).text("check_circle");
                    tooltip(status, "installed");

                    $(descr).off("click");
                    $(descr).click(function() {modalLogin(name, packages_to_install, level);});

                } else {
                    $(el).text('person');
                    $(el).off("click");
                    $(el).click(function() {modalLogin(name, packages_to_install, level);});
                    tooltip(el, "login to install " + name);
                    $(status).text("");
                }
            } else {
                if (installed) { // INSTALLED
                    $(el).text('delete');
                    $(el).off("click");
                    $(el).click(function() {uninstall(name, packages_to_install, level);});
                    tooltip(el, "delete " + name);
                    $(status).text("check_circle");
                    tooltip(status, "installed");
                } else { // UNINSTALLED
                    if  (packages_to_install != "") {
                        $(el).text('get_app');
                        $(el).off("click");
                        $(el).click(function() {install(name, packages_to_install, level);});
                        tooltip(el, "install " + name);
                        $(status).text("");
                    }
                }
            }
        } else { // IS NOT AVAILABLE
            $(el).text('lock_open');
            $(el).off("click");
            $(el).click(function() {onDemand(name);});
            tooltip(el, name + " is not available");
        }
    }
    catch (err){
        //alert("ERROR AQUI: "+err);
    }
}


function renderApp(item) {
    var fs = require('fs');
    var marked = require("marked");

    //Change font-size header in markdown

    var renderer = new marked.Renderer();
    renderer.heading = function (text, level) {
        var escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
        return '<h' + (level + 3) + '><a name="' +
             escapedText +
             '" class="anchor" href="#' +
             escapedText +
             '"><span class="header-link" </span></a><span>' + text +
             '</span></h' + (level + 3) + '>';
    };

    var truncatedDesc = "";
    if (item.description) {
        truncatedDesc = item.description.split('\n')[0] + "...";

        var data = {
            server: global.server,
            cid:  global.label["id"],
            computer: global.label["name"],
            project: global.project,
            uuid: global.uuid,
            app: item.name,
            _app: replaceAll(item.name, " ", "")
        };
        item.description = Mustache.render(item.description, data);

    }

    var data = {
        name: item.name,
        idaction: "action-" + replaceAll(item.name, " ", ""),
        icon: item.icon,
        description: marked(item.description, {renderer: renderer}),
        truncated: truncatedDesc,
        category: item.category.name,
        rating: renderRating(item.score)
    };

    return Mustache.to_html(fs.readFileSync('templates/app.html', 'utf8'), data);
}


function renderRating(score) {
    var rating = "";

    for (var step = 0; step < score; step++) {
        rating += '<i class="material-icons tiny">star</i>';
    }
    for (var step = score; step < 5; step++) {
        rating += '<i class="material-icons tiny blue-grey-text text-lighten-4">star</i>';
    }

    return rating;
}

// LABEL
function showLabel(){
    var fs = require('fs');
    var data = {
        "server": global.server,
        "cid":  global.label["id"],
        "name": global.label["name"],
        "project": global.project,
        "uuid": global.uuid,
        "helpdesk": global.label["helpdesk"],
        "ip": global.ip,
        "mask": global.mask,
        "network": global.network,
        "qrcode": Mustache.to_html(fs.readFileSync('templates/qrcode.html', 'utf8'), {"qrcode": global.qr.createImgTag(2,2)}),
        "qrcode2": Mustache.to_html(fs.readFileSync('templates/qrcode2.html', 'utf8'), {"qrcode": global.qr.createImgTag(3,3)})

    }

    $('#container').html(Mustache.to_html(fs.readFileSync('templates/label.html', 'utf8'), data));
    $('.tooltipped').tooltip({delay: 100});

    $('#print-label').click(printLabel);

    labelDone();
}

function printLabel(){
    window.print();
}


function checkUser(user,password) {
    var path = require('path');
    var script = '"' + path.join(gui.__dirname, 'py', 'check_user.py') + '"';
    var execSync = require('child_process').execSync;

    try {
        execSync("python " + script + " " + user + " " + password);
        $('#auth').text("yes");
        return true;
    }
    catch(err) {
        $('#auth').text("");

        swal({
            title: "Cancelled",
            html: "login error",
            type: "error",
            showCancelButton: false,
            confirmButtonText: "OK"
            }).then(function() {
            }, function(dismiss){
                // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                if (dismiss === 'cancel') {
                }
        });
        return false;
    }
}

// SETTINGS
function showSettings() {
    var fs = require('fs');
    $('#container').html(fs.readFileSync('templates/settings.html','utf8'));

    setSettings();

    $('#showalways').change(function() {
        getSettings();
        saveSettings(global.settings);
    });
}


// PMS

function postAction(name, pkgs, level) {
     global.packagesInstalled = installedPkgs(global.packages);
 //    if (global.packagesInstalled.includes(pkgs)) {
     if (pkgs.split(" ").diff(global.packagesInstalled).length == 0) {
        Materialize.toast(
            '<i class="material-icons">get_app</i> ' + name + " installed.",
            10000,
            'rounded green'
        );
     }
     else {
        Materialize.toast(
            '<i class="material-icons">delete</i> ' + name + " deleted.",
            10000,
            'rounded green'
        );
     }
     updateStatus(name, pkgs, level);
}

function installedPkgs(pks) {
    var path = require('path');
    var script = '"' + path.join(gui.__dirname, 'py', 'installed.py') + '"';
    var execSync = require('child_process').execSync;
    var cmd = "python "+ script  + ' "' + pks + '"';
    return execSync(cmd);
}


function installedDevs() {
    var path = require('path');
    var script = '"' + path.join(gui.__dirname, 'py', 'printers_installed.py') + '"';
    var execSync = require('child_process').execSync;
    var cmd = "python "+ script ;
    return JSON.parse(execSync(cmd));
}


function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function replaceAll(str, find, replace) {
    var find=escapeRegExp(find);

    var re = new RegExp(find, 'g');
    str = str.replace(re, replace);
    return str;
}

function getPkgNames() {
    var execSync = require('child_process').execSync;
    var packages = execSync('python -c "from __future__ import print_function;from migasfree_client.client import MigasFreeClient;print(MigasFreeClient().pms.available_packages(),end=\'\')"').toString();
    packages = replaceAll(packages, "'", '"');
    return JSON.parse(packages);
}

function spinner(id) {
    var fs = require('fs');
    $('#' + id).html(fs.readFileSync('templates/spinner.html','utf8'));
}


function install(name,pkgs,level) {
    $("#action-" + replaceAll(name," ", "")).tooltip("remove");
    Materialize.toast('installing '+ name + " ...", 10000, 'rounded grey')

    if (getOS()=="Linux") {
        var _cmd = 'LANG_ALL=C echo "y"|migasfree -ip "'+pkgs+'"';
    } else if (getOS()=="Windows") {
        var _cmd = 'migasfree -ip "'+pkgs+'"';
    }
    global.TERMINAL.run(
        _cmd,
        null,
        function() {postAction( name, pkgs, level );},
        "action-" + name
    );
}

function uninstall(name,pkgs,level) {
    $("#action-" + replaceAll(name, " ", "")).tooltip("remove");
    Materialize.toast('deleting '+ name +" ...", 10000, 'rounded grey')

    if (getOS()=="Linux") {
        var _cmd = 'LANG_ALL=C echo "y"|migasfree -rp "'+pkgs+'"';
    } else if (getOS()=="Windows") {
        var _cmd = 'migasfree -rp "'+pkgs+'"';
    }
    global.TERMINAL.run(
        _cmd,
        null,
        function() {postAction( name, pkgs, level );},
        "action-" + name
    );
}


function onDemand(application) {
    var path = require('path');
    swal({
      title: application + " no disponible",
      html:  global.label['helpdesk'] + "<br>" + global.label['name'] ,
      type: "warning",
      showCancelButton: false
    }, function() {

    });
}


function modalLogin(name, packages_to_install, level) {
    var fs = require('fs');
    swal({
        title: 'login',
        html: fs.readFileSync('templates/login.html','utf8'),
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: function () {
            return new Promise(function (resolve) {
                resolve([
                    $('#user').val(),
                    $('#password').val()
                ])
            })
        }
    }).then(function (result) {
        if (checkUser(result[0], result[1])){
            updateStatus(name, packages_to_install, level);
        }
    }).catch(swal.noop);
}


function getSettings() {
    global.settings["language"] = "en";
    global.settings["theme"] = "dark";
    global.settings["showalways"] = $("#showalways").is(':checked');
}

function setSettings() {
    $("#showalways").prop("checked", global.settings["showalways"]);
}

function readSettings() {
    var fs = require('fs');
    var path = require('path');
    var filePath = path.join(gui.App.dataPath, confFile);

    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, 'utf8')
        global.settings=JSON.parse(data);
    } else {
        global.settings = {};
        global.settings["language"] = "en";
        global.settings["theme"] = "dark";
        global.settings["showalways"] = false;
        saveSettings(global.settings);
    }
}

function saveSettings(settings) {
    var fs = require('fs');
    var path = require('path');
    var filePath = path.join(gui.App.dataPath, confFile);
    fs.writeFileSync(filePath, JSON.stringify(settings))
}


function presync() {
    var path = require('path');
    execDir(path.join(gui.__dirname, 'presync.d'));}


function postsync() {
    var path = require('path');
    execDir(path.join(gui.__dirname, 'postsync.d'));
}


function execDir(directory) {
    const execSync = require('child_process').execSync;
    var fs = require('fs');
    var path = require('path');

    try {
        fs.accessSync(directory);
    } catch (e) {
        return;
    }

    var files = fs.readdirSync(directory);
    for (var i in files) {
        global.TERMINAL.add(execSync(path.join(directory, files[i])));
    }
}




function getOS() {
    var OSName="Unknown";
    if (navigator.appVersion.indexOf("Win")!=-1) OSName="Windows";
    if (navigator.appVersion.indexOf("Mac")!=-1) OSName="MacOS";
    if (navigator.appVersion.indexOf("X11")!=-1) OSName="UNIX";
    if (navigator.appVersion.indexOf("Linux")!=-1) OSName="Linux";
    return OSName;
}


