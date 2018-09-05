BuildArchitectures: x86_64
Name:          migasfree-play
Version:       1
Release:       2
Summary:       GUI for migasfree client
License:       GPL
Packager:      Alberto Gacías
Vendor:        migasfree team
Source0:       %{name}-%{version}.tar.gz
URL:           https://github.com/migasfree/migasfree-play
Requires:      migasfree-client >= 4.14, sudo, bash, cronie
BuildRoot:     %{_tmppath}/%{name}-%{version}

%description
migasfree play is a GUI for migasfree client

%prep


%setup -q
make clean
make
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -r * %{buildroot}

%files
%defattr(-,root,root)
%define _unpackaged_files_terminate_build 0
%define _missing_doc_files_terminate_build 0
%attr(755,root,root) /usr/bin/*
%attr(-,root,root) /usr/share/*
%attr(440,root,root) /etc/sudoers.d/*
%attr(644,root,root) /etc/xdg/autostart/*

%config
/etc/sudoers.d/*

%doc

%clean
rm -rf %{buildroot}

%post
if [ -f /usr/share/migasfree-play/nwjs.tar.gz ]; then
    cd /usr/share/migasfree-play/
    rm -rf nwjs
    tar -xzvf nwjs.tar.gz > /dev/null
    rm nwjs.tar.gz
    mv nwjs* nwjs
    chown -R root:root nwjs
fi
chmod +x /etc/xdg/autostart/migasfree-play-sync.desktop

%changelog

