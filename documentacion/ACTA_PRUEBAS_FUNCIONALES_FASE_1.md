# ACTA DE PRUEBAS FUNCIONALES — EVENTAPP FASE 1

## Información general
**Proyecto:** EventApp  
**Versión:** Fase 1  
**Fecha:** ____________________  
**Probador(a):** ____________________  
**Ambiente:** ____________________  
**Dispositivo:** ____________________  

## Usuarios de prueba
- Ejecutivo 1: `ejecutivo.ana`
- Ejecutivo 2: `ejecutivo.bruno`
- Coordinador: `coord`
- Cliente 1: `cliente.alpina`
- Cliente 2: `cliente.colcafe`
- Cliente 3: `cliente.nutresa`

**Contraseña:** `Funcional.EventApp.2026`

---

## Checklist de pruebas

### 1. Acceso
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| L01 | Login Ejecutivo 1 | Ingresa correctamente | ☐ OK ☐ Falla | |
| L02 | Login Ejecutivo 2 | Ingresa correctamente | ☐ OK ☐ Falla | |
| L03 | Login Coordinador | Ingresa correctamente | ☐ OK ☐ Falla | |
| L04 | Login Cliente | Ingresa correctamente | ☐ OK ☐ Falla | |
| L05 | Login inválido | No permite acceso | ☐ OK ☐ Falla | |

### 2. Creación y gestión de eventos
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| E01 | Crear evento con cliente | Guarda correctamente | ☐ OK ☐ Falla | |
| E02 | Crear evento con ciudad existente | Guarda correctamente | ☐ OK ☐ Falla | |
| E03 | Crear evento con ciudad nueva/OTRO | Guarda correctamente | ☐ OK ☐ Falla | |
| E04 | Crear evento con punto completo | Guarda datos completos | ☐ OK ☐ Falla | |
| E05 | Crear evento con varias ciudades/puntos | Guarda correctamente | ☐ OK ☐ Falla | |

### 3. Cruces de coordinador y staff
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| C01 | Coordinador ocupado | No permite asignarlo | ☐ OK ☐ Falla | |
| C02 | Staff ocupado | No permite asignarlo | ☐ OK ☐ Falla | |
| C03 | Coordinador libre | Permite asignarlo | ☐ OK ☐ Falla | |
| C04 | Staff libre | Permite asignarlo | ☐ OK ☐ Falla | |

### 4. Revisión de eventos por ejecutivo
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| R01 | Ejecutivo ve sus eventos | Solo sus eventos | ☐ OK ☐ Falla | |
| R02 | Clasificación Activos/Inactivos | Correcta | ☐ OK ☐ Falla | |
| R03 | Evento vencido | Inactivo y sin edición | ☐ OK ☐ Falla | |
| R04 | Inactivar manual con comentario | Se inactiva | ☐ OK ☐ Falla | |
| R05 | Inactivar sin comentario | No permite | ☐ OK ☐ Falla | |

### 5. Módulo Coordinador
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| CO01 | Ver eventos asignados | Solo los suyos | ☐ OK ☐ Falla | |
| CO02 | Ver puntos agrupados por ciudad | Correcto | ☐ OK ☐ Falla | |
| CO03 | Ver detalle del punto | Muestra información | ☐ OK ☐ Falla | |
| CO04 | Contacto punto por llamada | Funciona | ☐ OK ☐ Falla | |
| CO05 | Contacto punto por WhatsApp | Funciona | ☐ OK ☐ Falla | |
| CO06 | Contacto ejecutivo | Llamada/WhatsApp | ☐ OK ☐ Falla | |

### 6. Fotos y reportes del coordinador
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| F01 | Cargar foto válida | Se guarda | ☐ OK ☐ Falla | |
| F02 | Ver galería | Muestra fotos guardadas | ☐ OK ☐ Falla | |
| RP01 | Guardar reporte operativo | Se guarda | ☐ OK ☐ Falla | |
| RP02 | Guardar reporte con redenciones | Se guarda | ☐ OK ☐ Falla | |
| RP03 | Reingresar al evento | Ve fotos/reportes cargados | ☐ OK ☐ Falla | |

### 7. Informe final del ejecutivo
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| IE01 | Ver listado de informes | Clasificado correctamente | ☐ OK ☐ Falla | |
| IE02 | Seleccionar algunas fotos | Permite seleccionar | ☐ OK ☐ Falla | |
| IE03 | Seleccionar todas las fotos | Permite seleccionar | ☐ OK ☐ Falla | |
| IE04 | Guardar borrador | Guarda correctamente | ☐ OK ☐ Falla | |
| IE05 | Publicar informe final | Publica correctamente | ☐ OK ☐ Falla | |
| IE06 | Editar después de publicar | No permite | ☐ OK ☐ Falla | |
| IE07 | Guardar borrador después de publicar | No permite | ☐ OK ☐ Falla | |

### 8. Módulo Cliente
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| CL01 | Cliente ve sus eventos | Solo sus eventos | ☐ OK ☐ Falla | |
| CL02 | Cliente ve informe publicado | Correctamente | ☐ OK ☐ Falla | |
| CL03 | Cliente no ve borradores | Correctamente | ☐ OK ☐ Falla | |
| CL04 | Cliente ve fotos seleccionadas | Solo las seleccionadas | ☐ OK ☐ Falla | |
| CL05 | Cliente contacta ejecutivo | Llamada/WhatsApp | ☐ OK ☐ Falla | |

### 9. Flujo End-to-End
| ID | Prueba | Esperado | Estado | Observaciones |
|---|---|---|---|---|
| E2E01 | Ejecutivo crea → Coordinador reporta → Ejecutivo publica → Cliente ve | Flujo completo exitoso | ☐ OK ☐ Falla | |
| E2E02 | Dos ejecutivos crean eventos distintos | No se cruzan datos | ☐ OK ☐ Falla | |
| E2E03 | Cliente A intenta ver evento de Cliente B | No lo ve | ☐ OK ☐ Falla | |
| E2E04 | Cruces de staff/coordinador | Se bloquean correctamente | ☐ OK ☐ Falla | |

---

## Resultado general
**Resultado final:**  
☐ Aprobado  
☐ Aprobado con observaciones  
☐ Rechazado  

**Observaciones generales:**  
____________________________________________________________  
____________________________________________________________  
____________________________________________________________  

**Responsable:** ________________________________  
**Firma:** _____________________________________  
**Fecha:** _____________________________________  
