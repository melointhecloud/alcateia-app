#!/bin/sh
# Writes /etc/nginx/real-ip.conf, which the server block includes (web/nginx.conf.template).
#
# Why a generated file: envsubst only swaps values in, it cannot leave a directive out, and an
# empty `set_real_ip_from` is a config error. So the directives exist only when asked for.
#
# REAL_IP_FROM   Addresses or CIDR ranges of the proxy in front of this container, separated by
#                spaces or commas. EMPTY (the default) = no trust at all: $remote_addr is the TCP
#                peer, exactly as before this file existed. The header below is believed ONLY on a
#                connection that comes from one of these, so a client that reaches nginx some other
#                way cannot choose its own address.
# REAL_IP_HEADER The header the proxy puts the client address in. Defaults to X-Real-IP once
#                REAL_IP_FROM is set (the one Railway documents). Ignored while REAL_IP_FROM is empty.
#
# `real_ip_recursive on` makes nginx walk an X-Forwarded-For list from the right, skipping the
# trusted hops, so an address a client put at the front of the list is never picked.
set -eu

# REAL_IP_CONF only exists so the test can write somewhere else.
out="${REAL_IP_CONF:-/etc/nginx/real-ip.conf}"
from="${REAL_IP_FROM:-}"
header="${REAL_IP_HEADER:-}"

fail() { echo "$0: $*" >&2; exit 1; }

if [ -z "$(printf '%s' "$from" | tr -d ' ,\t')" ]; then
  [ -z "$header" ] || echo "$0: REAL_IP_HEADER is set but REAL_IP_FROM is empty, so no header is trusted and REAL_IP_HEADER is ignored." >&2
  printf '%s\n' '# REAL_IP_FROM is empty: nothing is trusted, $remote_addr stays the TCP peer.' > "$out"
  exit 0
fi

[ -n "$header" ] || header=X-Real-IP
case "$header" in
  *[!A-Za-z0-9_-]*) fail "REAL_IP_HEADER=\"$header\" is not a header name (letters, digits, - and _ only)." ;;
esac

tmp="$out.tmp"
{
  echo "# Generated at start-up by /docker-entrypoint.d/12-real-ip.sh from REAL_IP_FROM and REAL_IP_HEADER."
  # No globbing while the list is split: a "*" in it must be rejected below, not expanded.
  set -f
  for addr in $(printf '%s' "$from" | tr ',' ' '); do
    case "$addr" in
      *[!0-9A-Fa-f:./]*) fail "REAL_IP_FROM entry \"$addr\" is not an IP address or CIDR range." ;;
      */0) fail "REAL_IP_FROM entry \"$addr\" would trust every address, which lets anyone forge the client IP." ;;
    esac
    echo "set_real_ip_from $addr;"
  done
  echo "real_ip_header $header;"
  echo "real_ip_recursive on;"
} > "$tmp" || { rm -f "$tmp"; exit 1; }
mv "$tmp" "$out"
echo "$0: client address taken from $header on connections from: $(printf '%s' "$from" | tr ',' ' ')"
