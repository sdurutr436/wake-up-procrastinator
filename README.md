# Wake Up Procrastinator

**Grupo 4 · Curso de trabajo con IA**

Aplicación web de productividad anti-procrastinación gamificada, construida como página estática en un único archivo HTML. Sin frameworks, sin backend, sin dependencias externas pesadas.

---

## Descripción

**Wake Up Procrastinator** combate la procrastinación mediante *misiones de enfoque*: bloques cortos de trabajo con recompensa inmediata. El usuario define una tarea, elige una duración y arranca un temporizador. Al completarlo, gana XP, sube de nivel y mantiene su racha diaria.

El problema que resuelve es claro: las tareas grandes paralizan. Las sesiones cortas con refuerzo visual instantáneo generan hábito y constancia sin necesidad de registro, cuenta ni conexión a internet.

---

## Funcionalidades

### Sistema de Misiones
- Input de texto para definir la tarea (máximo 50 caracteres)
- Duraciones predefinidas: 10, 15 y 25 minutos
- Tiempo personalizado configurable entre 1 y 180 minutos
- Temporizador con cuenta atrás en formato `mm:ss`
- Bloqueo de nuevas misiones mientras hay una activa
- Confirmación antes de abandonar una misión en curso

### Sistema de XP y Niveles
- XP ganado según la duración de cada misión completada
- Progresión exponencial: niveles iniciales rápidos, dificultad creciente
- Barra de progreso animada con transición suave (easing)
- Animación visual y sonido al subir de nivel

### Racha Diaria
- Mapa visual de progreso lineal (inspirado en mecánicas de plataformas 2D)
- Una casilla de avance por día activo (mínimo una misión completada)
- Reinicio automático si se falla un día
- Tres estados visuales por casilla: completada, actual y bloqueada

### Sistema de Medallas
- Panel lateral con medallas desbloqueables y estado de progreso
- Progreso visible al pasar el cursor (ejemplo: `3/5 días`)

| Medalla | Condición |
|---|---|
| Primer paso | Completar 1 misión |
| Enfoque inicial | 3 misiones en un mismo día |
| Cerebro constante | 5 días con actividad registrada |
| Disciplina base | 10 misiones totales |
| Hyperfocus | Completar una misión de 25 minutos |
| Constancia | 7 días consecutivos con actividad |
| Maestro del enfoque | Acumular 1000 XP total |

### Persistencia
- Todo guardado en `localStorage` del navegador
- Funciona completamente offline
- Sin cuenta, sin servidor, sin registro

---

## Stack Técnico

| Elemento | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 nativo (variables, grid, animaciones) |
| Lógica | Vanilla JavaScript (ES6+) |
| Iconos | [Lucide Icons](https://lucide.dev/) via CDN |
| Tipografía | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts |
| Persistencia | `localStorage` |
| Backend | Ninguno |
| Frameworks | Ninguno |

---

## Despliegue

### Opción 1 — Navegador local

```bash
git clone https://github.com/sdurutr436/wake-up-procrastinator.git
cd wake-up-procrastinator

open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

> **Nota:** Al abrir desde `file://`, algunos navegadores pueden restringir el acceso a `localStorage`. Se recomienda servirlo desde un servidor local o cualquier hosting estático.

### Opción 2 — GitHub Pages

1. Ir a **Settings → Pages** en el repositorio
2. En *Source*, seleccionar la rama `main` y la carpeta `/ (root)`
3. Guardar los cambios
4. La aplicación quedará disponible en `https://sdurutr436.github.io/wake-up-procrastinator/`

### Opción 3 — Netlify / Vercel

Arrastrar la carpeta al panel de [Netlify Drop](https://app.netlify.com/drop) o crear un nuevo proyecto en [Vercel](https://vercel.com/new). No requiere configuración adicional.

---

## Estructura del Proyecto

```
wake-up-procrastinator/
└── index.html
```

```
<head>    → Metadatos y fuentes
<style>   → CSS (reset, tipografía, layout, componentes, estados, animaciones, responsive)
<body>    → Estructura HTML semántica
<script>  → Lucide CDN (iconos)
<script>  → JS (constantes, medallas, estado, persistencia, lógica,
               temporizador, renderizado, utilidades, eventos, inicialización)
```


---

## Equipo

| Rol | Participante |
| :-- | :-- |
| Spec Lead | [@nolocardeno](https://github.com/nolocardeno) |
| IA Whisperer | [@Aranaaa00](https://github.com/Aranaaa00) |
| Security Officer | [@abenper](https://github.com/abenper) |
| Demo \& Docs | [@sdurutr436](https://github.com/sdurutr436) |


---

## Decisiones de Seguridad

- No se usa `innerHTML` — el DOM se construye con `textContent` y métodos seguros
- No se usa `eval` ni código dinámico de ningún tipo
- Los inputs se validan con `trim()` y comprobación de longitud máxima
- Sin peticiones externas en tiempo de ejecución, salvo la carga inicial de fuentes e iconos

---

## Licencia

Proyecto académico desarrollado como parte del **Curso de trabajo con IA — Grupo 4**.