#!/bin/bash
# Helper script to run Jekyll server with Homebrew Ruby

/opt/homebrew/opt/ruby/bin/bundle exec jekyll serve --host 0.0.0.0 "$@"
