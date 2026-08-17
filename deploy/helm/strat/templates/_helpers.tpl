{{- define "strat.labels" -}}
app.kubernetes.io/name: strat
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
