# Maintainer: Mark Kiraly <mark.kiraly.hu@gmail.com>
pkgname=libgendesktop
pkgver=1.0
pkgrel=1
pkgdesc="Simple Electron GUI for Library Genesis with extra features."
arch=('any')
url="https://github.com/ProgrammerGnome/libgendesktop"
license=('MIT')
depends=('electron' 'nodejs')
makedepends=('npm')
source=("$pkgname-$pkgver.tar.gz::https://github.com/ProgrammerGnome/libgendesktop/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('SKIP') # Optional: cseréld pontos értékre, ha véglegesíted

build() {
  cd "$srcdir/libgendesktop-$pkgver"
  npm install --omit=dev
}

package() {
  cd "$srcdir/libgendesktop-$pkgver"

  mkdir -p "$pkgdir/opt/$pkgname"
  cp -r . "$pkgdir/opt/$pkgname"

  mkdir -p "$pkgdir/usr/bin"
  echo "#!/bin/bash
  exec /usr/bin/electron /opt/$pkgname" > "$pkgdir/usr/bin/$pkgname"
  chmod +x "$pkgdir/usr/bin/$pkgname"
}
