# TransportePerez

Sistema de gestión de transporte escolar para **Inversiones Perez** (La Ceiba, Atlántida, Honduras).
Proyecto de Graduación — Ingeniería en Informática, CEUTEC La Ceiba.

## Estructura

| Carpeta | Descripción |
| --- | --- |
| `transporte-web/` | Panel administrativo — React + Vite + TypeScript + Mantine |
| `transporte-movil/` | App de conductores y padres — React Native + Expo |
| `docs/` | Documentación técnica del sistema |
| `firestore.rules` | Reglas de seguridad de Firestore |

## Stack

- **Backend:** Firebase Firestore + Firebase Authentication (Email/Password), plan Spark
- **Mapas:** Leaflet / OpenStreetMap
- **Notificaciones:** Expo Push Notifications

## Configuración local

Ambos proyectos requieren un archivo `.env` con las credenciales de Firebase
(no versionado por seguridad). La app móvil además necesita `google-services.json`
y `GoogleService-Info.plist` en `transporte-movil/`.

```bash
# Panel web
cd transporte-web && npm install && npm run dev

# App móvil
cd transporte-movil && npm install && npx expo start
```
