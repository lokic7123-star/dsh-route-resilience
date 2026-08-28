window.__ModuleLoader__.load({
	id: "dsh-route-resilience",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\dev\dsh-route-resilience\src\client\RouteResilienceSettingsSection.module.css.mjs
		const css = ".WZo2HG_page{max-width:760px;color:var(--dsw-alias-label-primary);border-top:1px solid var(--dsw-alias-border-l2);margin-top:28px;padding-top:16px}.WZo2HG_description,.WZo2HG_placeholder{color:var(--dsw-alias-label-tertiary);line-height:1.5}.WZo2HG_panelTitle{margin:0 0 8px;font-size:15px}.WZo2HG_editorTitle{margin:20px 0 4px;font-size:13px}.WZo2HG_status{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:8px;gap:8px;margin:12px 0 4px;padding:12px 14px;display:grid}.WZo2HG_statusHead{justify-content:space-between;align-items:center;gap:10px;display:flex}.WZo2HG_statusTotal{color:var(--dsw-alias-label-tertiary);font-size:12px}.WZo2HG_nextRequest{margin:0;font-size:13px}.WZo2HG_statusGroup{gap:6px;padding:8px 0 0;display:grid}.WZo2HG_statusGroupHead{align-items:center;gap:10px;display:flex}.WZo2HG_groupId{font-weight:600}.WZo2HG_pointer{color:var(--dsw-alias-label-tertiary);font-size:12px}.WZo2HG_statusRow{align-items:center;gap:10px;display:flex}.WZo2HG_rowProvider{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.WZo2HG_rowModel{color:var(--dsw-alias-label-tertiary);font-size:12px}.WZo2HG_badge{white-space:nowrap;border-radius:999px;flex-shrink:0;padding:2px 8px;font-size:11px;line-height:1.6}.WZo2HG_badgeActive{color:var(--dsw-alias-label-success,var(--dsw-alias-label-primary));border:1px solid var(--dsw-alias-border-l2)}.WZo2HG_badgeQuarantined{color:var(--dsw-alias-label-warning,var(--dsw-alias-label-primary));border:1px solid var(--dsw-alias-border-l2)}.WZo2HG_badgeDisabled{color:var(--dsw-alias-label-danger);border:1px solid var(--dsw-alias-border-l2)}.WZo2HG_fallbackTag,.WZo2HG_activeTag{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);border-radius:999px;flex-shrink:0;padding:1px 8px;font-size:11px}.WZo2HG_group{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;gap:12px;margin:12px 0;padding:16px;display:grid}.WZo2HG_groupHeader,.WZo2HG_target,.WZo2HG_actions,.WZo2HG_numbers{align-items:center;gap:10px;display:flex}.WZo2HG_groupHeader>label:first-child,.WZo2HG_codes,.WZo2HG_numbers label{flex:1;gap:6px;display:grid}.WZo2HG_numbers{align-items:flex-start}.WZo2HG_active{white-space:nowrap}.WZo2HG_target input,.WZo2HG_codes input,.WZo2HG_groupHeader input,.WZo2HG_numbers input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);min-width:0;color:inherit;border-radius:6px;padding:8px 10px}.WZo2HG_target input{flex:1}.WZo2HG_target input[type=password]{flex:2}.WZo2HG_keyActions{gap:8px;display:flex}button{background:var(--dsw-alias-bg-module-platform);color:inherit;cursor:pointer;border:0;border-radius:6px;padding:8px 12px}button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}button:disabled{cursor:default;opacity:.6}.WZo2HG_error{color:var(--dsw-alias-label-danger)}";
		const tag = "dsh-route-resilience/RouteResilienceSettingsSection.module.css";
		if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css='" + tag + "']")) {
			const node = document.createElement("style");
			node.dataset.plugin = "dsh-route-resilience";
			node.dataset.pluginCss = tag;
			node.textContent = css;
			document.head.appendChild(node);
		}
		var RouteResilienceSettingsSection_module_css_default = {
			"statusTotal": "WZo2HG_statusTotal",
			"activeTag": "WZo2HG_activeTag",
			"badgeActive": "WZo2HG_badgeActive",
			"page": "WZo2HG_page",
			"rowModel": "WZo2HG_rowModel",
			"group": "WZo2HG_group",
			"description": "WZo2HG_description",
			"statusGroup": "WZo2HG_statusGroup",
			"status": "WZo2HG_status",
			"statusHead": "WZo2HG_statusHead",
			"active": "WZo2HG_active",
			"badgeQuarantined": "WZo2HG_badgeQuarantined",
			"placeholder": "WZo2HG_placeholder",
			"panelTitle": "WZo2HG_panelTitle",
			"statusGroupHead": "WZo2HG_statusGroupHead",
			"error": "WZo2HG_error",
			"numbers": "WZo2HG_numbers",
			"groupId": "WZo2HG_groupId",
			"pointer": "WZo2HG_pointer",
			"nextRequest": "WZo2HG_nextRequest",
			"statusRow": "WZo2HG_statusRow",
			"codes": "WZo2HG_codes",
			"target": "WZo2HG_target",
			"actions": "WZo2HG_actions",
			"badgeDisabled": "WZo2HG_badgeDisabled",
			"badge": "WZo2HG_badge",
			"fallbackTag": "WZo2HG_fallbackTag",
			"rowProvider": "WZo2HG_rowProvider",
			"keyActions": "WZo2HG_keyActions",
			"editorTitle": "WZo2HG_editorTitle",
			"groupHeader": "WZo2HG_groupHeader"
		};
		//#endregion
		//#region src/client/RouteResilienceSettingsSection.tsx
		/**
		* Route resilience management panel, rendered at the bottom of the Models
		* settings page (`settings.models.item`). Two areas:
		*
		* 1. Runtime status — fetched from the host's read-only `/api/dsh-route-resilience/
		*    status` route: the active group and per-group allocation pointers ("next
		*    request will use …"), one row per key (provider route, bound model,
		*    active/quarantined/disabled badge with recovery time, chain-end fallback
		*    tag). Refreshed on host document/credential/topology invalidations (the
		*    injected status ticker), after every save, and on a light poll while
		*    mounted so quarantine transitions show up live. The route carries route
		*    names and health states only — never key material.
		* 2. Configuration editor — reads and writes the `dsh-route-resilience` settings
		*    namespace through describe/mutate. Adding a key adds a target row, removing
		*    a key removes one, and the last row of each chain is automatically the
		*    fallback (chain order is priority; there is no separate toggle).
		*/
		const NAMESPACE = "dsh-route-resilience";
		const LLM_PI_AI_NAMESPACE = "llm-pi-ai";
		const STATUS_PATH = "/api/dsh-route-resilience/status";
		/** Light poll cadence so runtime health transitions surface without reload. */
		const STATUS_POLL_MS = 5e3;
		function emptyGroup() {
			return {
				id: "",
				targets: [{
					provider: "",
					model: ""
				}, {
					provider: "",
					model: ""
				}],
				retryableCodes: [],
				quarantineBaseMs: void 0,
				quarantineCapMs: void 0
			};
		}
		/** Normalize the host settings document into the editable draft. */
		function valueOf(view) {
			const raw = view.value;
			return {
				groups: (raw?.groups ?? []).map((group) => ({
					id: group.id,
					targets: group.targets,
					retryableCodes: group.retryableCodes ?? [],
					quarantineBaseMs: group.quarantineBaseMs,
					quarantineCapMs: group.quarantineCapMs
				})),
				activeGroup: raw?.activeGroup
			};
		}
		/** Provider route names already declared in the llm-pi-ai namespace. */
		function providersOf(view) {
			if (view === void 0) return /* @__PURE__ */ new Set();
			const raw = view.value;
			return new Set(Object.keys(raw?.providers ?? {}));
		}
		/** Derive the credential reference for a provider route (mirrors the Models page). */
		function deriveKeyRef(provider) {
			return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
		}
		/**
		* Profile template for a newly added key route: copy the group's first
		* existing provider's non-credential fields so models/api/baseURL stay in
		* step, then attach the new route's own credential reference. Falls back to
		* the target's model alone when no existing provider profile is available.
		*/
		function templateProfile(value, provider, llmView) {
			const templateProvider = value.groups.flatMap((group) => group.targets).find((target) => target.provider !== provider && providersOf(llmView).has(target.provider));
			if (templateProvider !== void 0) {
				const profile = (llmView?.value)?.providers?.[templateProvider.provider];
				if (profile !== void 0) {
					const { apiKeyEnv: _env, ...rest } = profile;
					return {
						...rest,
						apiKeyEnv: deriveKeyRef(provider)
					};
				}
			}
			return {
				apiKeyEnv: deriveKeyRef(provider),
				models: [{ id: value.groups[0]?.targets[0]?.model ?? "deepseek-chat" }]
			};
		}
		/** Next free provider route name for a key added to the given group. */
		function nextProviderName(value, llmView, groupIndex) {
			const group = value.groups[groupIndex];
			const base = group?.targets[0]?.provider ?? group?.id ?? "provider";
			const taken = providersOf(llmView);
			for (const target of value.groups.flatMap((g) => g.targets)) taken.add(target.provider);
			let candidate = `${base}-2`;
			for (let i = 2; taken.has(candidate); i += 1) candidate = `${base}-${i}`;
			return candidate;
		}
		/** Parse a millisecond number input; blank or invalid input becomes unset. */
		function parseMillis(raw) {
			const trimmed = raw.trim();
			if (trimmed === "") return void 0;
			const parsed = Number(trimmed);
			return Number.isFinite(parsed) ? parsed : void 0;
		}
		/**
		* Resolve a css-module class by name. The module contract guarantees every
		* key used at runtime exists (lightningcss emits each referenced class), so
		* the indexed-record access narrows to a definite string here.
		*/
		function badgeClass(name) {
			return RouteResilienceSettingsSection_module_css_default[name] ?? "";
		}
		/** Localized label and badge class for one key's health record. */
		function statusBadge(health, t) {
			if (health.status === "active") return {
				label: t("statusActive"),
				className: badgeClass("badgeActive")
			};
			if (health.status === "disabled") return {
				label: t("statusDisabled"),
				className: badgeClass("badgeDisabled")
			};
			const remainingMs = health.quarantinedUntil - Date.now();
			return {
				label: remainingMs > 0 ? t("recoverIn").replace("{seconds}", String(Math.max(1, Math.ceil(remainingMs / 1e3)))) : t("statusQuarantined"),
				className: badgeClass("badgeQuarantined")
			};
		}
		/** Human-facing identity of one target: provider, model, or both. */
		function targetText(target) {
			return target.model.length === 0 || target.model === target.provider ? target.provider : `${target.provider} (${target.model})`;
		}
		/**
		* Render the Models-page key management panel: status area on top, then the
		* configuration editor.
		* @param props - composed slot props (runtime share, locale, inject face).
		*/
		function RouteResilienceSettingsSection({ api, useStatus, t }) {
			const tick = useStatus((snapshot) => snapshot);
			const [view, setView] = (0, react.useState)();
			const [value, setValue] = (0, react.useState)();
			const [configStatus, setConfigStatus] = (0, react.useState)("loading");
			const [error, setError] = (0, react.useState)();
			const [snapshot, setSnapshot] = (0, react.useState)();
			const [statusState, setStatusState] = (0, react.useState)("loading");
			const [llmView, setLlmView] = (0, react.useState)();
			const [keyDrafts, setKeyDrafts] = (0, react.useState)({});
			const [focusProvider, setFocusProvider] = (0, react.useState)();
			const providerInputs = /* @__PURE__ */ new Map();
			const loadConfig = (0, react.useCallback)(async () => {
				if (api === void 0) return;
				setConfigStatus("loading");
				const response = await api.settings.describe({});
				if (!response.result.ok) throw new Error(response.result.error.message);
				const next = response.result.value.namespaces.find((item) => item.ns === NAMESPACE);
				if (next === void 0) {
					setConfigStatus("unavailable");
					return;
				}
				const llm = response.result.value.namespaces.find((item) => item.ns === LLM_PI_AI_NAMESPACE);
				setLlmView(llm);
				setView(next);
				setValue(valueOf(next));
				setKeyDrafts({});
				setConfigStatus("ready");
			}, [api]);
			const loadStatus = (0, react.useCallback)(async () => {
				try {
					const response = await fetch(STATUS_PATH, { cache: "no-store" });
					if (!response.ok) {
						setStatusState("unavailable");
						return;
					}
					const body = await response.json();
					if (typeof body !== "object" || body === null) {
						setStatusState("unavailable");
						return;
					}
					const data = body.data;
					if (typeof data !== "object" || data === null) {
						setStatusState("unavailable");
						return;
					}
					setSnapshot(data);
					setStatusState("ready");
				} catch {
					setStatusState("unavailable");
				}
			}, []);
			(0, react.useEffect)(() => {
				loadConfig().catch((cause) => {
					setError(cause instanceof Error ? cause.message : String(cause));
					setConfigStatus("error");
				});
				loadStatus();
			}, [
				loadConfig,
				loadStatus,
				tick
			]);
			(0, react.useEffect)(() => {
				const timer = setInterval(() => {
					loadStatus();
				}, STATUS_POLL_MS);
				return () => clearInterval(timer);
			}, [loadStatus]);
			const save = async () => {
				if (api === void 0 || view === void 0 || value === void 0) return;
				setConfigStatus("saving");
				setError(void 0);
				try {
					const seen = /* @__PURE__ */ new Set();
					for (const group of value.groups) for (const target of group.targets) {
						if (target.provider.length === 0) throw new Error(t("keyNameRequired"));
						if (seen.has(target.provider)) throw new Error(t("keyNameDuplicate").replace("{provider}", target.provider));
						seen.add(target.provider);
					}
					const llmProviders = providersOf(llmView);
					const newProviders = [...new Set(value.groups.flatMap((group) => group.targets.map((target) => target.provider)))].filter((provider) => provider.length > 0 && !llmProviders.has(provider));
					const createdRoutes = [];
					let llmRevision = llmView?.revision;
					const rollbackRoutes = async () => {
						let revision = llmRevision;
						for (const provider of createdRoutes) {
							if (revision === void 0) break;
							const response = await api.settings.mutate({
								ns: LLM_PI_AI_NAMESPACE,
								ops: [{
									op: "unset",
									path: ["providers", provider]
								}],
								expectedRevision: revision
							});
							if (response.result.ok) revision = response.result.value.revision;
						}
					};
					try {
						for (const provider of newProviders) {
							if (llmRevision === void 0) break;
							const template = templateProfile(value, provider, llmView);
							const response = await api.settings.mutate({
								ns: LLM_PI_AI_NAMESPACE,
								ops: [{
									op: "set",
									path: ["providers", provider],
									value: template
								}],
								expectedRevision: llmRevision
							});
							if (!response.result.ok) throw new Error(response.result.error.message);
							llmRevision = response.result.value.revision;
							createdRoutes.push(provider);
						}
						for (const provider of newProviders) {
							const ref = deriveKeyRef(provider);
							const draft = keyDrafts[provider];
							if (draft !== void 0 && draft.length > 0) {
								const stored = await api.credentials.set({
									ref,
									value: draft
								});
								if (!stored.result.ok) throw new Error(stored.result.error.message);
							}
						}
						const groupResponse = await api.settings.mutate({
							ns: NAMESPACE,
							ops: [{
								op: "set",
								path: [],
								value: {
									groups: value.groups.map((group) => ({
										id: group.id,
										targets: group.targets,
										...group.retryableCodes.length > 0 ? { retryableCodes: group.retryableCodes } : {},
										...group.quarantineBaseMs !== void 0 ? { quarantineBaseMs: group.quarantineBaseMs } : {},
										...group.quarantineCapMs !== void 0 ? { quarantineCapMs: group.quarantineCapMs } : {}
									})),
									...value.activeGroup === void 0 ? {} : { activeGroup: value.activeGroup }
								}
							}],
							expectedRevision: view.revision
						});
						if (!groupResponse.result.ok) throw new Error(groupResponse.result.error.message);
						setView(groupResponse.result.value);
						setValue(valueOf(groupResponse.result.value));
					} catch (cause) {
						await rollbackRoutes();
						throw cause;
					}
					setKeyDrafts({});
					setConfigStatus("saved");
					loadConfig();
					loadStatus();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setConfigStatus("error");
				}
			};
			if (configStatus === "loading" && value === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: RouteResilienceSettingsSection_module_css_default.placeholder,
				children: t("loading")
			});
			if (configStatus === "unavailable") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: RouteResilienceSettingsSection_module_css_default.placeholder,
				children: t("unavailable")
			});
			if (value === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: RouteResilienceSettingsSection_module_css_default.placeholder,
				children: error ?? ""
			});
			const updateGroup = (index, group) => {
				const previous = value.groups[index];
				const activeFollows = value.activeGroup !== void 0 && previous !== void 0 && value.activeGroup === previous.id && group.id !== previous.id;
				setValue({
					...value,
					groups: value.groups.map((item, itemIndex) => itemIndex === index ? group : item),
					...activeFollows ? { activeGroup: group.id } : {}
				});
			};
			const updateTarget = (groupIndex, targetIndex, patch) => {
				const previous = value.groups[groupIndex]?.targets[targetIndex];
				const renamed = patch.provider !== void 0 && previous !== void 0 && patch.provider !== previous.provider && keyDrafts[previous.provider] !== void 0;
				setValue({
					...value,
					groups: value.groups.map((group, index) => index !== groupIndex ? group : {
						...group,
						targets: group.targets.map((item, itemIndex) => itemIndex === targetIndex ? {
							...item,
							...patch
						} : item)
					})
				});
				if (renamed && previous !== void 0 && patch.provider !== void 0) {
					const draft = keyDrafts[previous.provider];
					if (draft !== void 0) {
						const next = { ...keyDrafts };
						next[patch.provider] = draft;
						delete next[previous.provider];
						setKeyDrafts(next);
					}
				}
			};
			/** Add one more key slot to a group: new provider route + credential ref. */
			const addKey = (groupIndex) => {
				const group = value.groups[groupIndex];
				const provider = nextProviderName(value, llmView, groupIndex);
				const model = group?.targets[0]?.model ?? "";
				setValue({
					...value,
					groups: value.groups.map((item, index) => index !== groupIndex ? item : {
						...item,
						targets: [
							...item.targets.slice(0, -1),
							{
								provider,
								model
							},
							...item.targets.slice(-1)
						]
					})
				});
				setKeyDrafts({
					...keyDrafts,
					[provider]: ""
				});
				setFocusProvider(provider);
			};
			/** Remove one key slot from a group (route stays declared; unset separately). */
			const removeKey = (groupIndex, targetIndex) => {
				const removed = value.groups[groupIndex]?.targets[targetIndex];
				setValue({
					...value,
					groups: value.groups.map((item, index) => index !== groupIndex ? item : {
						...item,
						targets: item.targets.filter((_t, i) => i !== targetIndex)
					})
				});
				if (removed !== void 0 && keyDrafts[removed.provider] !== void 0) {
					const next = { ...keyDrafts };
					delete next[removed.provider];
					setKeyDrafts(next);
				}
			};
			const healthOf = (provider) => snapshot?.health.find((entry) => entry.provider === provider);
			const nextTarget = (() => {
				if (snapshot === void 0 || snapshot.activeGroup === void 0) return void 0;
				const group = snapshot.groups.find((candidate) => candidate.id === snapshot.activeGroup);
				if (group === void 0) return void 0;
				return group.targets[snapshot.rotation[group.id] ?? 0];
			})();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: RouteResilienceSettingsSection_module_css_default.page,
				"aria-label": t("title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: RouteResilienceSettingsSection_module_css_default.panelTitle,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RouteResilienceSettingsSection_module_css_default.description,
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RouteResilienceSettingsSection_module_css_default.status,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RouteResilienceSettingsSection_module_css_default.statusHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("statusTitle") }), snapshot !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RouteResilienceSettingsSection_module_css_default.statusTotal,
								children: t("statusTotal").replace("{count}", String(snapshot.health.length))
							})]
						}), statusState === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RouteResilienceSettingsSection_module_css_default.placeholder,
							children: t("statusLoading")
						}) : statusState === "unavailable" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RouteResilienceSettingsSection_module_css_default.placeholder,
							children: t("statusUnavailable")
						}) : snapshot === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RouteResilienceSettingsSection_module_css_default.placeholder,
							children: t("statusUnavailable")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RouteResilienceSettingsSection_module_css_default.nextRequest,
							role: "status",
							"aria-live": "polite",
							children: nextTarget === void 0 ? t("idle") : t("nextRequest").replace("{target}", targetText(nextTarget))
						}), snapshot.groups.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RouteResilienceSettingsSection_module_css_default.placeholder,
							children: t("empty")
						}) : snapshot.groups.map((group) => {
							const pointer = snapshot.rotation[group.id] ?? 0;
							const pointerTarget = group.targets[pointer];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RouteResilienceSettingsSection_module_css_default.statusGroup,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RouteResilienceSettingsSection_module_css_default.statusGroupHead,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: RouteResilienceSettingsSection_module_css_default.groupId,
											children: group.id
										}),
										snapshot.activeGroup === group.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: RouteResilienceSettingsSection_module_css_default.activeTag,
											children: t("activeGroup")
										}) : null,
										pointerTarget !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: RouteResilienceSettingsSection_module_css_default.pointer,
											children: [
												t("pointer"),
												": ",
												targetText(pointerTarget)
											]
										})
									]
								}), group.targets.map((target, targetIndex) => {
									const health = healthOf(target.provider);
									const fallback = targetIndex === group.targets.length - 1;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RouteResilienceSettingsSection_module_css_default.statusRow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RouteResilienceSettingsSection_module_css_default.rowProvider,
												children: target.provider
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RouteResilienceSettingsSection_module_css_default.rowModel,
												children: target.model
											}),
											health === void 0 ? null : (() => {
												const badge = statusBadge(health, t);
												return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: `${RouteResilienceSettingsSection_module_css_default.badge} ${badge.className}`,
													role: "img",
													"aria-label": badge.label,
													title: badge.label,
													children: badge.label
												});
											})(),
											fallback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RouteResilienceSettingsSection_module_css_default.fallbackTag,
												children: t("fallback")
											}) : null
										]
									}, `${target.provider}-${targetIndex}`);
								})]
							}, group.id);
						})] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: RouteResilienceSettingsSection_module_css_default.editorTitle,
						children: t("targets")
					}),
					value.groups.map((group, groupIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						className: RouteResilienceSettingsSection_module_css_default.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RouteResilienceSettingsSection_module_css_default.groupHeader,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("groupId"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										value: group.id,
										onChange: (event) => updateGroup(groupIndex, {
											...group,
											id: event.target.value
										})
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: RouteResilienceSettingsSection_module_css_default.active,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "activeGroup",
											checked: value.activeGroup === group.id && group.id.length > 0,
											onChange: () => setValue({
												...value,
												activeGroup: group.id
											})
										}), t("active")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setValue({
											...value,
											groups: value.groups.filter((_item, index) => index !== groupIndex),
											...value.activeGroup === group.id ? { activeGroup: void 0 } : {}
										}),
										children: t("remove")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("targets") }),
							group.targets.map((target, targetIndex) => {
								const isNewKey = keyDrafts[target.provider] !== void 0;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RouteResilienceSettingsSection_module_css_default.target,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											"aria-label": t("provider"),
											placeholder: isNewKey ? t("newKeyName") : t("provider"),
											value: target.provider,
											ref: (node) => {
												providerInputs.set(target.provider, node);
												if (focusProvider === target.provider) {
													node?.focus();
													node?.select();
													setFocusProvider(void 0);
												}
											},
											onChange: (event) => updateTarget(groupIndex, targetIndex, { provider: event.target.value })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											"aria-label": t("model"),
											placeholder: t("model"),
											value: target.model,
											onChange: (event) => updateTarget(groupIndex, targetIndex, { model: event.target.value })
										}),
										isNewKey ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											"aria-label": t("newKeyValue"),
											placeholder: t("newKeyPlaceholder").replace("{ref}", deriveKeyRef(target.provider)),
											type: "password",
											value: keyDrafts[target.provider] ?? "",
											onChange: (event) => setKeyDrafts({
												...keyDrafts,
												[target.provider]: event.target.value
											})
										}) : null,
										targetIndex === group.targets.length - 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: RouteResilienceSettingsSection_module_css_default.fallbackTag,
											children: t("fallback")
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => removeKey(groupIndex, targetIndex),
											children: t("remove")
										})
									]
								}, `${targetIndex}-${target.provider}`);
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: RouteResilienceSettingsSection_module_css_default.keyActions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => addKey(groupIndex),
									children: t("addKey")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: RouteResilienceSettingsSection_module_css_default.codes,
								children: [t("codes"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: group.retryableCodes.join(", "),
									onChange: (event) => updateGroup(groupIndex, {
										...group,
										retryableCodes: event.target.value.split(",").map((code) => code.trim()).filter(Boolean)
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RouteResilienceSettingsSection_module_css_default.numbers,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("quarantineBaseMs"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: 1,
									value: group.quarantineBaseMs ?? "",
									onChange: (event) => updateGroup(groupIndex, {
										...group,
										quarantineBaseMs: parseMillis(event.target.value)
									})
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("quarantineCapMs"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: 1,
									value: group.quarantineCapMs ?? "",
									onChange: (event) => updateGroup(groupIndex, {
										...group,
										quarantineCapMs: parseMillis(event.target.value)
									})
								})] })]
							})
						]
					}, groupIndex)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RouteResilienceSettingsSection_module_css_default.actions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setValue({
									...value,
									groups: [...value.groups, emptyGroup()]
								}),
								children: t("addGroup")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: configStatus === "saving",
								onClick: () => {
									save();
								},
								children: configStatus === "saving" ? t("saving") : t("save")
							}),
							configStatus === "saved" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("saved") })
						]
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: RouteResilienceSettingsSection_module_css_default.error,
						children: error
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			title: "路由韧性",
			description: "配置多个 provider 路由组成的模型组：每个路由独立持有一把 API key，请求按序分配；失败时自动切换到下一路由，失败路由按指数退避隔离或禁用。点击\"添加密钥\"自动新建一个 provider 路由并绑定新的密钥引用，可给密钥起名（如 zen-主账号）；保存后填入该密钥值即可使用。",
			loading: "正在加载配置…",
			unavailable: "当前 DSH 未启用 dsh-route-resilience 插件。",
			statusTitle: "运行状态",
			statusTotal: "共 {count} 把密钥",
			statusLoading: "正在获取运行状态…",
			statusUnavailable: "无法获取运行状态（host 端未启用 dsh-route-resilience）",
			statusActive: "活跃",
			statusQuarantined: "隔离中",
			statusDisabled: "已禁用",
			recoverIn: "{seconds} 秒后恢复",
			fallback: "兜底",
			activeGroup: "当前组",
			pointer: "分配起点",
			nextRequest: "下一请求将使用 {target}",
			idle: "路由韧性未启用（未设置当前组）",
			empty: "尚未配置任何模型组。",
			addGroup: "添加模型组",
			groupId: "组名（虚拟 provider 名）",
			active: "作为当前组",
			targets: "密钥列表（每把密钥一个 provider 路由，链末自动作为兜底）",
			provider: "Provider 路由",
			model: "模型",
			codes: "可切换错误码（逗号分隔）",
			quarantineBaseMs: "隔离初始退避（毫秒）",
			quarantineCapMs: "隔离退避上限（毫秒）",
			addTarget: "添加路由",
			addKey: "添加密钥",
			newKeyName: "给这把密钥起个名字（如 zen-主账号、go-手机号）",
			newKeyValue: "新密钥值（保存后写入凭据服务）",
			newKeyPlaceholder: "粘贴密钥值（保存后存储为 {ref}）",
			keyNameRequired: "密钥名称不能为空：每把密钥都需要一个 provider 路由名（如 zen-主账号）。",
			keyNameDuplicate: "密钥名称 \"{provider}\" 已存在：每把密钥必须使用唯一的名称，请改名后再保存。",
			remove: "删除",
			save: "保存",
			saving: "保存中…",
			saved: "已保存"
		};
		const en = {
			title: "Route resilience",
			description: "Configure model groups over multiple provider routes: each route owns its own API key and the group routes requests across them, failing over to the next route on eligible errors and quarantining or disabling failed routes. \"Add key\" creates a new provider route bound to a fresh key reference; name it meaningfully (e.g. zen-主账号) and paste the key value on save.",
			loading: "Loading configuration…",
			unavailable: "The dsh-route-resilience plugin is not enabled on this DSH host.",
			statusTitle: "Runtime status",
			statusTotal: "{count} keys total",
			statusLoading: "Fetching runtime status…",
			statusUnavailable: "Runtime status unavailable (dsh-route-resilience host half not active)",
			statusActive: "Active",
			statusQuarantined: "Quarantined",
			statusDisabled: "Disabled",
			recoverIn: "recovers in {seconds}s",
			fallback: "Fallback",
			activeGroup: "Active group",
			pointer: "Pointer",
			nextRequest: "Next request will use {target}",
			idle: "Failover idle (no active group set)",
			empty: "No model groups configured yet.",
			addGroup: "Add group",
			groupId: "Group ID (virtual provider)",
			active: "Use as active group",
			targets: "Keys (one provider route per key; the last route is the automatic fallback)",
			provider: "Provider route",
			model: "Model",
			codes: "Failover error codes (comma-separated)",
			quarantineBaseMs: "Quarantine base backoff (ms)",
			quarantineCapMs: "Quarantine backoff cap (ms)",
			addTarget: "Add route",
			addKey: "Add key",
			newKeyName: "Name this key (e.g. zen-主账号, go-手机号)",
			newKeyValue: "New key value (stored to the credential service on save)",
			newKeyPlaceholder: "Paste key value (saved as {ref})",
			keyNameRequired: "Key name cannot be empty: every key needs a provider route name (e.g. zen-主账号).",
			keyNameDuplicate: "Key name \"{provider}\" already exists: every key must have a unique name, rename it before saving.",
			remove: "Remove",
			save: "Save",
			saving: "Saving…",
			saved: "Saved"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.dshRouteResilience";
		/** Services required by this browser plugin. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote"
		];
		/**
		* Register the Route Resilience management panel at the bottom of the Models
		* settings page (`settings.models.item`, declared by ui-settings-models'
		* Models entry). The status ticker converges the panel on pushed invalidations
		* instead of polling for configuration drift: any host settings document,
		* credential, or adapter-topology change bumps it, and the mounted panel
		* re-fetches the host status route and the settings document.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-route-resilience: settings dictionaries");
			const connection = ctx.get("connection");
			let tick = 0;
			const listeners = /* @__PURE__ */ new Set();
			const bump = () => {
				tick += 1;
				for (const listener of listeners) listener();
			};
			const statusTicker = {
				getSnapshot: () => tick,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
			ctx.effect(() => {
				const disposers = [
					ctx.remote.$on("settings/document-updated", bump),
					ctx.remote.$on("credentials/updated", bump),
					ctx.remote.$on("llm/adapters-updated", bump)
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "dsh-route-resilience: status invalidations");
			const injected = () => ({
				api: connection.api,
				hooks: { status: statusTicker }
			});
			ctx.slots.inject("settings.models.item", () => ctx.slots.register({
				name: "settings.models.item",
				id: "dsh-route-resilience",
				order: 0,
				locale: NS,
				inject: injected
			}, RouteResilienceSettingsSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map