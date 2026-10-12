# EXUVIA — publicar y gestionar el Archivo sin tocar código

Esta versión convierte el Archivo de Exuvia en una colección gestionable desde un panel visual. El sitio sigue siendo estático y conserva su diseño; durante cada despliegue, `build.mjs` genera automáticamente las tarjetas del Archivo, las páginas individuales y las tres tarjetas recientes de Inicio a partir de los artículos Markdown.

## Qué podrás hacer desde el panel

En `https://TU-DOMINIO/admin/` podrás crear, editar y retirar de publicación entradas. Tendrás campos para título, fecha, tipo de registro, resumen, etiquetas, imagen, frase destacada, nota de rigor, pregunta final y el texto completo. No tendrás que editar `archivo.html` ni crear a mano una página HTML por artículo.

Cuando guardes una entrada publicada, Decap la guardará en GitHub. Netlify detectará el cambio, volverá a generar el sitio y publicará las actualizaciones. La página del Archivo y las tarjetas recientes de Inicio se actualizarán durante ese despliegue.

## Importante: no usar Netlify Drop para esta versión

Para que el panel pueda guardar artículos y que estos se publiquen automáticamente, Netlify tiene que construir la web desde un repositorio GitHub conectado. No despliegues esta versión arrastrando una carpeta a Netlify Drop: esa modalidad no configura el flujo automático del CMS.

## Guía de configuración — una sola vez

### 1. Descargar y descomprimir

Descomprime el ZIP de EXUVIA en tu Mac. No separes los archivos y conserva la carpeta `assets` y la carpeta `content`.

### 2. Crear el repositorio privado en GitHub (con aplicación, sin terminal)

1. Instala GitHub Desktop desde <https://desktop.github.com/> e inicia sesión con tu cuenta GitHub. Si todavía no tienes cuenta, créala en <https://github.com/>.
2. En GitHub Desktop, elige **File → Add Local Repository** y selecciona la carpeta descomprimida de Exuvia.
3. Si indica que todavía no es un repositorio Git, pulsa la opción para **crear un repositorio en esa carpeta**. El nombre recomendado es `exuvia-web` y la rama principal `main`.
4. Haz el primer commit con el resumen `Preparar web Exuvia con CMS`.
5. Pulsa **Publish repository**. Selecciona tu cuenta y marca la opción para mantener el repositorio **Private**.

El repositorio privado es recomendable porque guardará también borradores editoriales y el código fuente. La web publicada seguirá siendo pública.

### 3. Publicar conectando GitHub con Netlify

1. Inicia sesión en <https://app.netlify.com/>.
2. Elige **Add new project / Import an existing project** y selecciona GitHub.
3. Autoriza Netlify para acceder al repositorio privado `exuvia-web` y selecciónalo.
4. Deja que Netlify lea `netlify.toml`. La orden de construcción debe ser `npm run build` y el directorio publicado `dist`.
5. Pulsa **Deploy** y espera a que el primer despliegue termine correctamente.

El proceso de construcción no necesita instalar librerías externas: utiliza Node incluido en Netlify.

### 4. Configurar el inicio de sesión del panel

El panel usa el backend GitHub de Decap CMS con el proveedor OAuth de Netlify. El `build.mjs` detecta la dirección del repositorio a través de la variable `REPOSITORY_URL` de Netlify y completa automáticamente el campo `repo` en el archivo `admin/config.yml` publicado. No tienes que escribir a mano el nombre de tu usuario de GitHub.

1. En GitHub, ve a **Settings → Developer settings → OAuth Apps → New OAuth App** (en una cuenta personal, entra desde tu perfil). Como Homepage URL usa la dirección provisional de Netlify que acaba de crearse.
2. En **Authorization callback URL**, escribe exactamente: `https://api.netlify.com/auth/done`.
3. Registra la aplicación. Copia el **Client ID** y genera un **Client Secret**. Guarda ambos durante este proceso; el secreto no se debe incluir en ningún archivo de la web ni en GitHub.
4. En Netlify, abre tu proyecto y ve a **Project configuration → Security → OAuth** (puede aparecer como OAuth providers / Authentication providers según la vista).
5. Instala el proveedor **GitHub**, pega el Client ID y el Client Secret, y guarda.
6. Comprueba que `https://TU-SITIO.netlify.app/admin/config.yml` muestra el repositorio real con formato `tu-usuario/exuvia-web`, no el texto `TU_USUARIO_GITHUB/exuvia-web`.

Si la configuración publicada todavía muestra el marcador, comprueba que Netlify está conectado al repositorio GitHub y lanza un nuevo deploy. No publiques el Client Secret en este archivo: solo se guarda en la configuración segura de Netlify.

### 5. Entrar al panel

Abre `https://TU-SITIO.netlify.app/admin/`, pulsa para iniciar sesión con GitHub y autoriza el acceso. Como tu repositorio es privado, solo las cuentas con acceso de escritura a ese repositorio podrán editar el contenido.

## Cómo publicar un artículo nuevo

1. En el panel, entra en **Archivo de investigación** y pulsa **New Archivo de investigación**.
2. Escribe el título, la fecha, el tipo de registro y el resumen. Añade etiquetas si te sirven para organizar la investigación.
3. Puedes dejar vacío el número de registro; el generador asignará uno en la web al construirla. Si quieres un identificador concreto, escríbelo.
4. Añade la frase destacada, la nota sobre el estado/los límites del texto y la pregunta final si corresponden. Escribe el cuerpo con el editor Markdown: puedes usar títulos, negrita, cursiva, listas y enlaces.
5. Deja activado **Visible en el archivo** para que se publique. Si lo desactivas, el registro no aparecerá en la web.
6. Pulsa **Save**. Espera a que el despliegue de Netlify termine. La nueva entrada aparecerá en `archivo.html`, tendrá su propia página y podrá ocupar uno de los tres accesos recientes de Inicio.

Para editar una entrada existente, abre su registro en el panel, cambia los campos y guarda. Para retirar una entrada de la web, desactiva **Visible en el archivo**. No elimines archivos HTML a mano: la colección `content/archivo` es ahora la fuente de verdad de las entradas.

## Contenido y estructura

- `content/archivo/*.md`: contenido de los artículos; se edita desde el CMS.
- `admin/index.html` y `admin/config.yml`: panel y configuración de Decap.
- `build.mjs`: genera páginas de artículos, Archivo e Inicio.
- `netlify.toml`: define el comando de construcción y la carpeta `dist`.
- `assets/uploads/`: imágenes que se suban desde el panel.
- `contacto.html`: formulario preparado para Netlify Forms.
- `privacidad.html`: borrador legal que debe completarse y revisarse antes de hacer pública la web.

## Formulario de contacto

Después de publicar, en Netlify activa la detección de formularios en **Forms** y configura una notificación por email a `exuvia.info@gmail.com`. Envía un mensaje de prueba. Revisa y completa antes de publicar los datos pendientes del aviso de privacidad.

## Notas de mantenimiento

- No uses el método de despliegue manual de arrastrar y soltar para actualizar esta web; sube los cambios al repositorio para que Netlify ejecute la construcción.
- No guardes contraseñas, tokens ni claves secretas dentro de esta carpeta.
- La lista de episodios de audio de Spreaker puede actualizarse desde el reproductor integrado. Las portadas o enlaces seleccionados de los videopodcast de YouTube siguen siendo una selección editorial que se puede cambiar cuando publiques vídeos nuevos.
