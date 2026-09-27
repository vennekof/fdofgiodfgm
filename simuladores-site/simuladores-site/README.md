# Los Simuladores — sitio + Supabase

## 1. Supabase (una sola vez)

1. Abrí tu proyecto → **SQL** → New query
2. Pegá **todo** el archivo `supabase-setup.sql` → **Run**
3. Table Editor: deben verse 24 filas en `episodes` y 1 en `site_settings`

### Usuario admin
Authentication → Users → el usuario `vennekof@gmail.com` debe tener **contraseña**.
Si no la tenés:
- Add user / o Reset password desde el panel
- Esa contraseña es la del login Admin del sitio (no la vieja vennek0016)

### Auth URL (recomendado)
Authentication → URL Configuration:
- Site URL: `https://lossimuladoresonline.online`
- Redirect URLs: `https://lossimuladoresonline.online/**`

## 2. Netlify
Subí esta carpeta completa (drag & drop).

## 3. Cómo editar a futuro (sin volver a subir zip)
1. Entrá al sitio → Ctrl+Shift+A → Admin
2. Email: vennekof@gmail.com + tu clave de Supabase
3. Editá capítulos / Ajustes → Guardar
4. Cualquier visitante ve los cambios al recargar

Fondo: Ajustes → "URL o archivo de fondo". Preferí URL pública (ej. `/fondo-simuladores.png`). Base64 muy grande puede fallar en la DB.

## 4. Analytics
Ya está Google Analytics: `G-XZYN0NB2DM`

## 5. Anuncios Adsterra
Admin → Ajustes → Publicidad → activar + pegar HTML del anuncio.

## Archivos clave
- `js/config.js` — supabaseUrl + supabaseAnonKey
- `supabase-setup.sql` — tablas + seed
- `js/episodes.json` — respaldo offline
