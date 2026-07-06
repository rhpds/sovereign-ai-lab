SHELL := /bin/bash
SCRIPT_DIR := $(dir $(lastword $(MAKEFILE_LIST)))/../oberon
NAMESPACE ?= sovereign-ai-lab

.PHONY: install uninstall

install:
	NS=$(NAMESPACE) bash $(SCRIPT_DIR)/deploy.sh

uninstall:
	oc delete namespace $(NAMESPACE) --ignore-not-found
