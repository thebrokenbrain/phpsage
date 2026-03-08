#!/usr/bin/env python3

import argparse
import logging
import shutil
import tempfile
from os.path import isdir, isfile, join
from urllib.parse import urlsplit

from mkdocs.commands.build import build
from mkdocs.config import load_config
from mkdocs.livereload import LiveReloadServer, _serve_url


log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run MkDocs dev server with explicit watch registration.")
    parser.add_argument("-f", "--config-file", default="mkdocs.yml")
    parser.add_argument("-a", "--dev-addr", default="0.0.0.0:8000")
    parser.add_argument("--dirty", action="store_true")
    args = parser.parse_args()

    site_dir = tempfile.mkdtemp(prefix="mkdocs_")

    def get_config():
        return load_config(
            config_file=args.config_file,
            site_dir=site_dir,
            dev_addr=args.dev_addr,
        )

    config = get_config()
    config.plugins.on_startup(command="serve", dirty=args.dirty)

    host, port = config.dev_addr
    mount_path = urlsplit(config.site_url or "/").path
    serve_url = _serve_url(host, port, mount_path)
    config.site_url = serve_url

    def builder(current_config=None):
        log.info("Building documentation...")
        if current_config is None:
            current_config = get_config()
            current_config.site_url = serve_url
        build(current_config, serve_url=serve_url, dirty=args.dirty)

    server = LiveReloadServer(
        builder=builder,
        host=host,
        port=port,
        root=site_dir,
        mount_path=mount_path,
    )

    def error_handler(code):
        if code in (404, 500):
            error_page = join(site_dir, f"{code}.html")
            if isfile(error_page):
                with open(error_page, "rb") as file_handle:
                    return file_handle.read()
        return None

    server.error_handler = error_handler

    try:
        builder(config)

        server.watch(config.docs_dir)
        if config.config_file_path:
            server.watch(config.config_file_path)
        for item in config.watch:
            server.watch(item)

        plugin_server = config.plugins.on_serve(server, config=config, builder=builder)
        if plugin_server is not None:
            server = plugin_server

        server.serve(open_in_browser=False)
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        server.shutdown()
        config.plugins.on_shutdown()
        if isdir(site_dir):
            shutil.rmtree(site_dir)


if __name__ == "__main__":
    main()