"use strict";

var gui = require("nw.gui");
var path = require("path");
var win = gui.Window.get();
var confFile = "settings.json";
var consoleLog = path.join(gui.__dirname, "console.log");

function getOS() {
    var osName = "Unknown";

    if (navigator.appVersion.indexOf("Win") !== -1) {osName = "Windows";}
    if (navigator.appVersion.indexOf("Mac") !== -1) {osName = "MacOS";}
    if (navigator.appVersion.indexOf("X11") !== -1) {osName = "UNIX";}
    if (navigator.appVersion.indexOf("Linux") !== -1) {osName = "Linux";}

    return osName;
}

function spinner(id) {
    const fs = require("fs");
    $("#" + id).html(fs.readFileSync("templates/spinner.html", "utf8"));
}

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function replaceAll(str, find, replace) {
    var exp = escapeRegExp(find);
    var re = new RegExp(exp, "g");

    return str.replace(re, replace);
}

function replaceColors(txt) {
    txt = replaceAll(txt, "\u001b[92m", "<span class='console-section'>");
    txt = replaceAll(txt, "\u001b[93m", "<span class='console-warning'>");
    txt = replaceAll(txt, "\u001b[91m", "<span style='console-error'>");
    txt = replaceAll(txt, "\u001b[32m", "<span style='console-info'>");
    txt = replaceAll(txt, "\u001b[0m", "</span>");
    txt = txt.replace(/(?:\r\n|\r|\n)/g, "<br />");

    return txt;
}

function tooltip(id, text) {
    var anchor = $(id);

    anchor.attr("data-tooltip", text);
    anchor.attr("delay", 100);
    anchor.attr("position", "bottom");
    anchor.tooltip();
}

function exit() {
    const fs = require("fs");

    fs.writeFile(consoleLog, global.terminal, function (err) {
        if (err) {throw err;}
    });

    win.close();
}

function resizeTerminal() {
    scroll(0, 0);
    $("#console-output").height(
        $(window).height() - $("#footer-bar").height() - $("#menu-bar").height() - 80
    );
}

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
    };
}());

$(window).bind("resize", function () {
    try {
        resizeTerminal();
    }
    catch(err) {
        // nothing
    }
});

gui.Window.get().on("close", function () {
    exit();
    gui.App.quit();
});

Array.prototype.diff = function (a) {
    return this.filter(function (i) {return a.indexOf(i) < 0;});
};

function addTokenHeader(xhr) {
     xhr.setRequestHeader("authorization", global.token);
}

function labelDone() {
    if (typeof global.label !== "undefined") {
        $("#machine").html(
            "<a class='js-external-link' href='http://{{server}}/admin/server/computer/{{cid}}/change/'>" + global.label["name"] + "</a>"
        );
        tooltip("#machine", global.server);

        var typeNumber = 4;
        var errorCorrectionLevel = "L";
        var qr = qrcode(typeNumber, errorCorrectionLevel);

        qr.addData(
            '{"model":"Computer","id":' + global.label["id"] + ',"server":"' + global.label["server"] + '"}'
        );
        qr.make();

        global.qr = qr;
    }
}

function getAttributeCID() {
    if (typeof global.label !== "undefined") {
        $.ajax({
            url: "http://" + global.server + "/api/v1/token/attributes/",
            type: "GET",
            beforeSend: addTokenHeader,
            data: {"property_att__prefix": "CID", "value": global.cid},
            success(data) {
                if (data.count === 1) {
                    global.att_cid = data.results[0].id;
                }
            },
            error(jqXHR, textStatus, errorThrown) {
                swal("Error:" + jqXHR.responseText);
            },
        });
    }
}

function saveSettings(settings) {
    const fs = require("fs");
    const path = require("path");
    var filePath = path.join(gui.App.dataPath, confFile);

    fs.writeFileSync(filePath, JSON.stringify(settings));
}

function readSettings() {
    const fs = require("fs");
    const path = require("path");
    var filePath = path.join(gui.App.dataPath, confFile);

    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, "utf8");
        global.settings = JSON.parse(data);
    }
    else {
        global.settings = {};
        global.settings["language"] = "en";
        global.settings["theme"] = "dark";
        global.settings["showalways"] = false;
        saveSettings(global.settings);
    }
}

function getPkgNames() {
    var execSync = require("child_process").execSync;
    var packages = execSync('python -c "from __future__ import print_function; from migasfree_client.client import MigasFreeClient; print(MigasFreeClient().pms.available_packages(), end=\'\')"').toString();
    packages = replaceAll(packages, "'", '"');
    return JSON.parse(packages);
}

function execDir(directory) {
    const execSync = require("child_process").execSync;
    const fs = require("fs");
    const path = require("path");

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

function presync() {
    const path = require("path");

    execDir(path.join(gui.__dirname, "presync.d"));
}

function postsync() {
    const path = require("path");

    execDir(path.join(gui.__dirname, "postsync.d"));
}

function beforeSync() {
    Materialize.toast("synchronizing...", 10000, "rounded grey");
    presync();
}

function afterSync() {
    postsync();
    global.pks_availables = getPkgNames();
    Materialize.toast(
        "<i class='material-icons'>sync</i>" + " synchronized",
        10000,
        "rounded green"
    );
}

function sync() {
    global.TERMINAL.run("migasfree -u", beforeSync, afterSync, "sync");
}

function showSync() {
    const fs = require("fs");

    $("#container").html(fs.readFileSync("templates/sync.html", "utf8"));
    resizeTerminal();
    global.TERMINAL.refresh();
    $("#sync").click(sync);
}

function runAsUserSync(cmd) {
    const execSync = require("child_process").execSync;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"' , '\\\"');
        execSync('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        execSync(cmd);
    }
}

function runAsUser(cmd) {
    const exec = require("child_process").exec;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"' , '\\\"');
        exec('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        exec(cmd);
    }
}

function supportExternalLinks(event) {
    function crawlDom(element) {
        var href;
        var isExternal = false;

        if (element.nodeName.toLowerCase() === "a") {
            href = element.getAttribute("href");
        }
        if (element.classList.contains("js-external-link")) {
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
            };
            href = Mustache.render(href, data);
            runAsUser('python -c "import webbrowser; webbrowser.open(\'' + href + '\')"');
        } else if (element.parentElement) {
            crawlDom(element.parentElement);
        }
    }

    crawlDom(event.target);
}

// PRINTERS
function queryPrintersPage(url) {
    $.ajax({
        url,
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            showPrinterItem(data);
            if (data.next) {
                var options = [{
                    selector: "footer",
                    offset: 0,
                    callback() {
                        if (data.next) {
                            queryPrintersPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $("#preload-next").hide();
            }
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function queryPrinters() {
    $("#printers").html("");
    $("#preload-next").show();
    spinner("preload-next");
    queryPrintersPage(
        "http://" + global.server + "/api/v1/token/devices/logical/availables/" +
        "?cid=" +  global.label["id"] + "&q=" + global.searchPrint
    );
}

function showPrinters() {
    const fs = require("fs");
    global.devs = installedDevs();

    $("#container").html(fs.readFileSync("templates/printers.html", "utf8"));
    spinner("printers");
    queryPrinters();
    $("#searchPrint").val(global.searchPrint);
    $("#searchPrint").bind("keydown", getCharPrint);
    $("#searchPrint").focus();
}

function changeAttributesPrinter(element, id, atts) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "PATCH",
        beforeSend: addTokenHeader,
        contentType: "application/json",
        data: JSON.stringify({"attributes": atts}),
        success(data) {
           global.TERMINAL.run(
                "migasfree -u",
                null,
                function() {
                    showPrinters();
                },
                element
           );
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("changeAttributesPrinter Error:" + jqXHR.responseText);
        },
    });
}

function installPrinter(element, id) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            var atts =  data.attributes;
            atts.push(global.att_cid);
            changeAttributesPrinter(element, id, atts);
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function uninstallPrinter(element, id) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            var atts =  data.attributes;
            //delete attribute from array
            var index = atts.indexOf(global.att_cid);
            if (index > -1) {
                atts.splice(index, 1);
            }

            changeAttributesPrinter(element, id, atts);
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function updateStatusPrinter(name, id) {
    var slug = replaceAll(name, " ", "");
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;
    var installed = ($.inArray(id, global.devs) >= 0);

    try {
        if (installed) {
            $(el).text("delete");
            $(el).off("click");
            $(el).click(function() {uninstallPrinter("action-" + slug, id);});
            $(status).text("check_circle");
            tooltip(el, "installed");
        } else {
            $(el).text("get_app");
            $(el).off("click");
            $(el).click(function() {installPrinter("action-" + slug, id);});
            $(status).text("");
            tooltip(el, "install");
        }
    }
    catch (err){
        // nothing
    }
}

function getDevice(logicalDev) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/devices/" + logicalDev.device.id + "/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(dev) {
            $("#printers").append(renderPrinter(logicalDev, dev));
            updateStatusPrinter(
                logicalDev.device.name + logicalDev.feature.name,
                logicalDev.id
            );
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function showPrinterItem(data) {
    $.each(data.results, function(i, item) {
        getDevice(item);
    });
    $(".collapsible").collapsible();  // FIXME
}

function installedDevs() {
    const path = require("path");
    const execSync = require("child_process").execSync;
    var script = '"' + path.join(gui.__dirname, "py", "printers_installed.py") + '"';
    var cmd = "python " + script;

    return JSON.parse(execSync(cmd));
}

function renderDict(data) {
    var ret= "";

    for (var element in data) {
        ret+= element + ": " + data[element] + "<br />";
    }
    return ret;
}

function renderInfoPrinter(data) {
    return renderDict(JSON.parse(data));
}

function renderPrinter(logicalDev, dev) {
    const fs = require("fs");
    var icon;

    if (dev.connection.name === "TCP") {
        icon = "assets/printer-net.png";
    } else {
        icon = "assets/printer-local.png";
    }

    var data = {
        name: logicalDev.device.name + " " + logicalDev.feature.name,
        idaction: "action-" + replaceAll(logicalDev.device.name + logicalDev.feature.name, " ", ""),
        icon,
        description: dev.model.name + " (" + dev.connection.name + ")" + "<hr />" + renderInfoPrinter(dev.data),
        truncated: dev.model.name + " (" + dev.connection.name + ")"
    };

    return Mustache.to_html(fs.readFileSync("templates/printer.html", "utf8"), data);
}

// APPS
function showCategories(categories) {
    $.each(categories, function(key, value) {
        $("#categories").append(
            $("<option>", {value: key}).text(value)
        );
    });
    $("#categories").val(global.category);
    $("#categories").material_select();
}

function queryCategories() {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/catalog/apps/categories/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
           global.categories = data;
           global.categories[0] = "All";
           showCategories(global.categories);
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function installedPkgs(pks) {
    const path = require("path");
    const execSync = require("child_process").execSync;
    var script = '"' + path.join(gui.__dirname, "py", "installed.py") + '"';
    var cmd = "python " + script + ' "' + pks + '"';

    return execSync(cmd);
}

function queryApps() {
    $("#apps").html("");
    $("#preload-next").show();
    global.packages = "";

    var categoryFilter = "";
    if (global.category !== 0) {
        categoryFilter = "&category=" + global.category;
    }

    spinner("preload-next");
    queryAppsPage(
        "http://" + global.server + "/api/v1/token/catalog/apps/availables/" +
        "?cid=" +  global.label["id"] +
        "&level=" + global.level +
        "&q=" + global.search +
        categoryFilter
    );
}

function showLevels() {
    var levels = {"": "All", "U": "User", "A": "Administrator"};

    $.each(levels, function(key, value) {
        $("#levels")
            .append($("<option>", {value: key})
            .text(value)
        );
    });
    $("#levels").val(global.level);
    $("#levels").material_select();
}

function renderRating(score) {
    var rating = "";

    for (var i = 0; i < score; i++) {
        rating += "<i class='material-icons tiny md-12'>star</i>";
    }
    for (var j = score; j < 5; j++) {
        rating += "<i class='material-icons tiny md-12 blue-grey-text text-lighten-4'>star</i>";
    }

    return rating;
}

function renderApp(item) {
    const fs = require("fs");
    const marked = require("marked");

    var renderer = new marked.Renderer();
    renderer.heading = function (text, level) {
        var escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");
        return "<h" + (level + 3) + "><a name='" +
             escapedText +
             "' class='anchor' href='#" +
             escapedText + "'></a><span>" + text +
             "</span></h" + (level + 3) + ">";
    };

    var data;
    var truncatedDesc = "";
    if (item.description) {
        truncatedDesc = item.description.split("\n")[0] + "...";

        data = {
            server: global.server,
            cid: global.label["id"],
            computer: global.label["name"],
            project: global.project,
            uuid: global.uuid,
            app: item.name,
            _app: replaceAll(item.name, " ", "")
        };
        item.description = Mustache.render(item.description, data);
    }

    data = {
        name: item.name,
        idaction: "action-" + replaceAll(item.name, " ", ""),
        icon: item.icon,
        description: marked(item.description, {renderer: renderer}),
        truncated: truncatedDesc,
        category: item.category.name,
        rating: renderRating(item.score)
    };

    return Mustache.to_html(fs.readFileSync("templates/app.html", "utf8"), data);
}

function showAppItem(data) {
    $.each(data.results, function(i, item) {
        if (item.category.id == global.category || global.category === 0) {
            if (item.level.id == global.level || global.level === "")  {
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
    });
    $(".collapsible").collapsible();  // FIXME
}

function queryAppsPage(url) {
    $.ajax({
        url,
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            $.each(data.results, function(i, item) {
                $.each(item.packages_by_project, function(i, pkgs) {
                    if (pkgs.project.name === global.project) {
                        global.packages += " " + pkgs.packages_to_install.join(" ");
                    }
                });
            });

            global.packagesInstalled = installedPkgs(global.packages);

            showAppItem(data);

            if (data.next) {
                var options = [{
                    selector: "footer",
                    offset: 0,
                    callback() {
                        if (data.next) {
                            queryAppsPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $("#preload-next").hide();
            }
        },
        error(jqXHR, textStatus, errorThrown) {
            swal("Error:" + jqXHR.responseText);
        },
    });
}

function showDescription(id) {
    $("#trunc-" + id).hide();
    $("#descr-" + id).show();
}

function showTruncated(id) {
    $("#descr-" + id).hide();
    $("#trunc-" + id).show();
}

function changedCategory() {
    global.category = $("#categories").val();
    queryApps();
}

function changedLevel() {
    global.level = $("#levels").val();
    queryApps();
}

function getChar(event) {
    var keyCode = ("which" in event) ? event.which : event.keyCode;

    if (keyCode === 13) {  // Enter
        global.search = $("#search").val();
        queryApps();
    }
}

function getCharPrint(event){
    var keyCode = ("which" in event) ? event.which : event.keyCode;

    if (keyCode === 13) {  // Enter
        global.searchPrint = $("#searchPrint").val();
        queryPrinters();
    }
}

function showApps() {
    const fs = require("fs");

    queryCategories();
    $("#container").html(fs.readFileSync("templates/apps.html", "utf8"));
    spinner("apps");
    queryApps();
    showLevels();

    $("#levels").change(changedLevel);
    $("#categories").change(changedCategory);
    $("#search").val(global.search);
    $("#search").bind("keydown", getChar);
    $("#search").focus();
}

function onDemand(application) {
    const path = require("path");

    swal({
        title: application + " no available",
        html: global.label["helpdesk"] + "<br />" + global.label["name"] ,
        type: "warning",
        showCancelButton: false
    }, function() {
    });
}

function updateStatus(name, packagesToInstall, level) {
    var slug = replaceAll(name, " ", "");
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;
    var installed;

    if (packagesToInstall == "") {
        installed = false;
    } else {
        installed = (packagesToInstall.split(" ").diff(global.packagesInstalled).length === 0)
    }

    try {
        if (packagesToInstall.split(" ").diff(global.pks_availables) == "") {  // AVAILABLE
            var person = "";
            if ($("#auth").text() === "" && level === "A") {  // NO LOGIN
                $(el).text("person");
                $(el).off("click");
                $(el).click(function() {modalLogin(name, packagesToInstall, level);});
                if (installed) {
                    tooltip(el, "login to delete " + name);
                    $(status).text("check_circle");
                    tooltip(status, "installed");

                    $(descr).off("click");
                    $(descr).click(function() {modalLogin(name, packagesToInstall, level);});
                } else {
                    tooltip(el, "login to install " + name);
                    $(status).text("");
                }
            } else {
                if (installed) {
                    $(el).text("delete");
                    $(el).off("click");
                    $(el).click(function() {uninstall(name, packagesToInstall, level);});
                    tooltip(el, "delete " + name);
                    $(status).text("check_circle");
                    tooltip(status, "installed");
                } else {
                    if (packagesToInstall != "") {
                        $(el).text("get_app");
                        $(el).off("click");
                        $(el).click(function() {install(name, packagesToInstall, level);});
                        tooltip(el, "install " + name);
                        $(status).text("");
                    }
                }
            }
        } else {  // IS NOT AVAILABLE
            $(el).text("lock_open");
            $(el).off("click");
            $(el).click(function() {onDemand(name);});
            tooltip(el, name + " is not available");
        }
    }
    catch(err) {
        // nothing
    }
}

// LABEL
function showLabel() {
    const fs = require("fs");
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
        "qrcode": Mustache.to_html(
            fs.readFileSync("templates/qrcode.html", "utf8"),
            {"qrcode": global.qr.createImgTag(2, 2)}
        ),
        "qrcode2": Mustache.to_html(
            fs.readFileSync("templates/qrcode2.html", "utf8"),
            {"qrcode": global.qr.createImgTag(3, 3)}
        )
    };

    $("#container").html(Mustache.to_html(fs.readFileSync("templates/label.html", "utf8"), data));
    $(".tooltipped").tooltip({delay: 100});

    $("#print-label").click(printLabel);

    labelDone();
}

function printLabel() {
    window.print();
}

function checkUser(user, password) {
    var path = require("path");
    var script = '"' + path.join(gui.__dirname, "py", "check_user.py") + '"';
    var execSync = require("child_process").execSync;

    try {
        execSync("python " + script + " " + user + " " + password);
        $("#auth").text("yes");
        return true;
    }
    catch(err) {
        $("#auth").text("");

        swal({
            title: "Cancelled",
            html: "login error",
            type: "error",
            showCancelButton: false,
            confirmButtonText: "OK"
        }).then(
            function () {},
            function (dismiss){
                // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                if (dismiss === "cancel") {
                    // nothing
                }
        });
        return false;
    }
}

// SETTINGS
function showSettings() {
    const fs = require("fs");

    $("#container").html(fs.readFileSync("templates/settings.html", "utf8"));

    setSettings();

    $("#showalways").change(function() {
        getSettings();
        saveSettings(global.settings);
    });
}

// PMS
function postAction(name, pkgs, level) {
    global.packagesInstalled = installedPkgs(global.packages);
    if (pkgs.split(" ").diff(global.packagesInstalled).length == 0) {
        Materialize.toast(
            "<i class='material-icons'>get_app</i> " + name + " installed.",
            10000,
            "rounded green"
        );
    }
    else {
        Materialize.toast(
            "<i class='material-icons'>delete</i> " + name + " deleted.",
            10000,
            "rounded green"
        );
    }
    updateStatus(name, pkgs, level);
}

function install(name, pkgs, level) {
    $("#action-" + replaceAll(name, " ", "")).tooltip("remove");
    Materialize.toast("installing " + name + " ...", 10000, "rounded grey")

    if (getOS() === "Linux") {
        var _cmd = 'LANG_ALL=C echo "y"|migasfree -ip "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        var _cmd = 'migasfree -ip "' + pkgs + '"';
    }
    global.TERMINAL.run(
        _cmd,
        null,
        function() {postAction(name, pkgs, level);},
        "action-" + name
    );
}

function uninstall(name, pkgs, level) {
    $("#action-" + replaceAll(name, " ", "")).tooltip("remove");
    Materialize.toast("deleting " + name  + " ...", 10000, "rounded grey")

    if (getOS() === "Linux") {
        var _cmd = 'LANG_ALL=C echo "y"|migasfree -rp "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        var _cmd = 'migasfree -rp "' + pkgs + '"';
    }
    global.TERMINAL.run(
        _cmd,
        null,
        function() {postAction(name, pkgs, level);},
        "action-" + name
    );
}

function modalLogin(name, packagesToInstall, level) {
    const fs = require("fs");

    swal({
        title: "login",
        html: fs.readFileSync("templates/login.html", "utf8"),
        focusConfirm: false,
        showCancelButton: true,
        preConfirm() {
            return new Promise(function (resolve) {
                resolve([
                    $("#user").val(),
                    $("#password").val()
                ])
            })
        }
    }).then(function (result) {
        if (checkUser(result[0], result[1])) {
            updateStatus(name, packagesToInstall, level);
        }
    }).catch(swal.noop);
}

function getSettings() {
    global.settings["language"] = "en";
    global.settings["theme"] = "dark";
    global.settings["showalways"] = $("#showalways").is(":checked");
}

function setSettings() {
    $("#showalways").prop("checked", global.settings["showalways"]);
}

function getGlobalData() {
    const execSync = require("child_process").execSync;
    const fs = require("fs");
    const path = require("path");
    var myArgs = gui.App.argv;

    if (typeof global.search === "undefined") {
        global.search = "";
    }

    if (typeof global.searchPrint === "undefined") {
        global.searchPrint = "";
    }

    readSettings();

    global.TERMINAL = (function() {
        if (typeof global.terminal == "undefined") {
            global.terminal = "";
        }
        var running = false;
        var stderr = "";

        function addToStdErr(txt) {
            stderr += txt;
        }

        return {
            add(txt) {
                try {
                    global.terminal = replaceColors(global.terminal + txt);
                    this.refresh();
                }
                catch(err) {
                    // nothing
                }
            },
            refresh() {
                 try {
                     $("#console-output").html(global.terminal);
                     var x = document.getElementById("console-output");
                     x.scrollTop = x.scrollHeight;
                 }
                 catch(err) {
                    // nothing
                 }
            },
            run(cmd, beforeCallback=null, afterCallback=null, id) {
                if (running) {
                    Materialize.toast(
                        "<i class='material-icons'>warning</i>" + " please wait, other process is running!!!",
                        10000,
                        "rounded red"
                    );
                }
                else {
                    running = true;

                    $("#" + id).addClass("blink");

                    if (beforeCallback) {
                        beforeCallback();
                    }

                    var spawn = require("child_process").spawn;
                    var process;

                    if (getOS() === "Linux") {
                        process = spawn("bash", ["-c", cmd]);
                    } else if (getOS() === "Windows") {
                        process = spawn("cmd", ["/C", cmd]);
                    }

                    this.add("<h3># " + cmd + "</h3>");

                    var date = new Date();
                    var n = date.toDateString();
                    var time = date.toLocaleTimeString();

                    global.TERMINAL.add("<h5>" + date + "</h5>");

                    process.stdout.on("data", function(data) {global.TERMINAL.add(data.toString());});

                    process.stderr.on("data", function(data) {
                        addToStdErr(data.toString());
                        global.TERMINAL.add("<span class='red'>" + data.toString() + "</span>");
                    });

                    // when the spawn child process exits, check if there were any errors
                    process.on("exit", function(code) {
                        if (code !== 0) {  // Syntax error
                            Materialize.toast(
                                "<i class='material-icons'>error</i> error:" + code + " " + cmd,
                                10000,
                                "rounded red"
                            );
                            win.show();
                        }
                        else {
                            if (stderr === "") {
                                if (afterCallback) {
                                    afterCallback();
                                }

                                if (id === "sync" &&  document.hidden) {  // sync ok & minimized -> exit
                                    exit();
                                }
                            }
                            else {
                                Materialize.toast(
                                    "<i class='material-icons'>error</i>" + replaceColors(stderr),
                                    10000,
                                    "rounded red"
                                );
                                stderr = "";
                            }
                        }

                        global.TERMINAL.add("<hr />");

                        $("#" + id).removeClass("blink");
                        running = false;
                    });
                }
            }
        };
    }());

    if (typeof global.sync === "undefined") {
        global.sync = (myArgs === "sync");
    }

    if (typeof global.token === "undefined") {
        var tokenfile =  path.join(process.cwd(), "token");
        if (fs.existsSync(tokenfile)) {
            global.token = "token " + fs.readFileSync(tokenfile, "utf8");
        } else {
            swal({
                title: "Error",
                type: "error",
                html: "Token not found in file: <b>" + tokenfile + "</b>",
                focusConfirm: true,
                showCancelButton: false
            });
        }
    }

    if (typeof global.conf === "undefined") {
        global.conf = execSync('python -c "from __future__ import print_function; from migasfree_client import settings; print(settings.CONF_FILE, end=\'\')"');
    }
    if (typeof global.server === "undefined") {
        global.server = execSync('python -c "from __future__ import print_function; from migasfree_client.utils import get_config; print(get_config(\'' + global.conf + '\', \'client\').get(\'server\', \'localhost\'), end=\'\')"');
    }
    if (typeof global.uuid === "undefined") {
        global.uuid = execSync('python -c "from __future__ import print_function; from migasfree_client.utils import get_hardware_uuid; print(get_hardware_uuid(), end=\'\')"');
    }
    if (typeof global.project === "undefined") {
        global.project = execSync('python -c "from __future__ import print_function; from migasfree_client.utils import get_mfc_project; print(get_mfc_project(), end=\'\')"');
    }
    if (typeof global.computername === "undefined") {
        global.computername = execSync('python -c "from __future__ import print_function; from migasfree_client.utils import get_mfc_computer_name; print(get_mfc_computer_name(), end=\'\')"');
    }
    if (typeof global.network === "undefined") {
        global.network = execSync('python -c "from __future__ import print_function; from migasfree_client.network import get_iface_net, get_iface_cidr, get_ifname; _ifname = get_ifname(); print(\'%s/%s\' % (get_iface_net(_ifname), get_iface_cidr(_ifname)), end=\'\')"');
    }
    if (typeof global.mask === "undefined") {
        global.mask = execSync('python -c "from __future__ import print_function; from migasfree_client.network import get_iface_mask, get_ifname; _ifname = get_ifname(); print(get_iface_mask(_ifname), end=\'\')"');
    }
    if (typeof global.ip === "undefined") {
        global.ip = execSync('python -c "from __future__ import print_function; from migasfree_client.network import get_iface_address, get_ifname; _ifname = get_ifname(); print(get_iface_address(_ifname), end=\'\')"');
    }
    if (typeof global.user === "undefined") {
        global.user = execSync('python -c "from __future__ import print_function; from migasfree_client import utils; _graphic_pid, _graphic_process = utils.get_graphic_pid(); print(utils.get_graphic_user(_graphic_pid), end=\'\')"');
    }
    if (typeof global.label === "undefined") {
        // LABEL
        $.getJSON(
            "http://" + global.server + "/get_computer_info/?uuid=" + global.uuid,
            {}
        ).done(function( data ) {
            global.label = data;
            global.cid = global.label["id"];
            getAttributeCID();
            labelDone();
            showApps();
        });
    } else {
        labelDone();
    }

    if (typeof global.category === "undefined") {
        global.category = 0;
    }

    if (typeof global.level === "undefined") {
        global.level = "";
    }

    if (typeof global.pks_availables === "undefined") {
        global.pks_availables = getPkgNames();
    }
}

function ready() {
    const fs = require("fs");

    getGlobalData();
    win.show();
    win.minimize();

    if (global.sync) {
        fs.unlinkSync(consoleLog);

        if (global.settings["showalways"]) {
            win.show();
        }
        showSync();
        sync();
    } else {
        fs.stat(consoleLog, function(err, stat) {
            if (err === null) {
                // consoleLog exists
                global.TERMINAL.add(fs.readFileSync(consoleLog, "utf8"));
            }
        });

        win.show();
    }

    $("#menu-console").click(showSync);
    $("#menu-apps").click(showApps);
    $("#menu-printers").click(showPrinters);
    $("#menu-label").click(showLabel);
    $("#menu-settings").click(showSettings);
}
