import re

file_path = "C:/Dev/ZonaFit/frontend/src/pages/GymSettings.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add link import
if "import { Link } from 'react-router-dom';" not in content:
    content = content.replace(
        "import { useAuth } from '../context/AuthContext';",
        "import { useAuth } from '../context/AuthContext';\nimport { Link } from 'react-router-dom';"
    )

new_header = """      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary">Configuración del Gimnasio</h1>
            {isNewRecord ? (
              <Badge variant="warning">Pendiente de Registro</Badge>
            ) : (
              <Badge variant="success">Activo</Badge>
            )}
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Información legal e institucional utilizada en facturas, recibos y reportes oficiales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link to="/settings/subscription">
              <ActionGlowButton>
                Gestionar Suscripción
              </ActionGlowButton>
            </Link>
          )}
          {!isAdmin && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-2 rounded-lg">
              <ShieldAlert size={16} />
              <span>Modo Lectura</span>
            </div>
          )}
        </div>
      </div>"""

# Replace old header
# The old header starts with "      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">"
# and ends right before "      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">"

old_header_regex = r"<div className=\"flex flex-col md:flex-row md:items-center justify-between gap-4\">.*?<form onSubmit=\{handleSubmit\(onSubmit\)\}"

content = re.sub(old_header_regex, new_header + "\n\n      <form onSubmit={handleSubmit(onSubmit)}", content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
