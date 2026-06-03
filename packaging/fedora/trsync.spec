%define app_name trsync
%define app_id com.jyo.trsync

Name:           %{app_name}
Version:        %{version}
Release:        1%{?dist}
Summary:        A modern GUI wrapper for rsync built with Tauri

License:        MIT
URL:            https://github.com/jyo64/trsync
Source0:        https://github.com/jyo64/trsync/archive/refs/tags/v%{version}.tar.gz

BuildRequires:  cargo
BuildRequires:  rust
BuildRequires:  pnpm
BuildRequires:  nodejs
BuildRequires:  webkit2gtk4.1-devel
BuildRequires:  libappindicator-gtk3-devel
BuildRequires:  librsvg2-devel
BuildRequires:  openssl-devel
BuildRequires:  gcc-c++

Requires:       webkit2gtk4.1
Requires:       libappindicator-gtk3
Requires:       zenity
Requires:       rsync

%description
Trsync provides a user-friendly GUI for rsync. It allows selecting files and directories
via an intuitive interface and executes synchronization securely through a Rust backend.

%prep
%autosetup -n %{app_name}-%{version}

%build
pnpm install --frozen-lockfile
pnpm tauri build --bundles none

%install
# Install binary
install -Dm0755 src-tauri/target/release/%{app_name} %{buildroot}%{_bindir}/%{app_name}

# Install desktop file
install -Dm0644 src-tauri/%{app_id}.desktop %{buildroot}%{_datadir}/applications/%{app_id}.desktop

# Install icons (Tauri standard location)
for size in 32 128 256; do
    if [ -f "src-tauri/icons/${size}x${size}.png" ]; then
        install -Dm0644 "src-tauri/icons/${size}x${size}.png" \
            %{buildroot}%{_datadir}/icons/hicolor/${size}x${size}/apps/%{app_id}.png
    fi
done

%files
%license LICENSE
%{_bindir}/%{app_name}
%{_datadir}/applications/%{app_id}.desktop
%{_datadir}/icons/hicolor/*/apps/%{app_id}.png*

%changelog
* Wed Jun 03 2026 Jyothish Atheendran <athi.jyothish@gmail.com> - %{version}-1
- Initial COPR release