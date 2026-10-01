# Configuración de Variables de Entorno en Vercel

## Solución al problema de URLs con localhost

Para solucionar el problema donde la IA genera URLs con `localhost:3000` en lugar del dominio de producción, necesitas configurar la variable de entorno `NEXT_PUBLIC_SITE_URL` en Vercel.

### Pasos para configurar en Vercel:

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona el proyecto `asistente-ia-delta`
3. Ve a **Settings** → **Environment Variables**
4. Agrega una nueva variable:
   - **Name**: `NEXT_PUBLIC_SITE_URL`
   - **Value**: `https://miasistentelab.com`
5. Selecciona los entornos donde aplicar (Production, Preview, Development)
6. Haz clic en **Save**
7. **Importante**: Redespliega tu proyecto para que los cambios surtan efecto

### ¿Por qué esto soluciona el problema?

En el archivo `app/api/upload-document/route.ts` (línea 41), el código genera la URL del archivo así:

```typescript
const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
```

Sin `NEXT_PUBLIC_SITE_URL` configurado en Vercel, cae en el fallback `http://localhost:3000`, lo que genera URLs incorrectas en producción.

## Configuración de Planes de Suscripción

### Nuevos Planes Implementados

- **Plan Personal**: $1.000/mes - Hasta 5 asistentes virtuales
- **Plan Enterprise**: $60.000/mes - Asistentes ilimitados

### Cambios en la Base de Datos

Necesitas agregar la columna `subscription_plan` a la tabla `profiles` en Supabase:

```sql
ALTER TABLE profiles ADD COLUMN subscription_plan TEXT DEFAULT 'personal';
```

Esta columna guardará el tipo de plan del usuario ('personal' o 'enterprise').

### Variables de entorno necesarias

Asegúrate de tener estas variables configuradas en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `NEXT_PUBLIC_SITE_URL` ← **Esta es la que soluciona el problema**
