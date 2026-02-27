
export const getResponsesInstructions = (
  sourceLanguage: string,
  targetLanguage: string,
  termTypesFileName: string,
  contextTypesFileName: string): string => `
    Usa los ficheros adjuntos para clasificar el término en ${targetLanguage}. Para cada término o expresión suministrado:
    - Traduce al ${sourceLanguage}.
    - Indica el valor "type" usando exclusivamente valores del fichero ${termTypesFileName}.
    - Indica el valor "context" usando exclusivamente valores del fichero ${contextTypesFileName}.
    - Indica el valor "rating" como #⭐⭐⭐, #⭐⭐ o #⭐.
    - Genera ejemplos exclusivamente en ${targetLanguage}.

    Es muy importante que cada ejemplo esté separado por "<br>" y no por otros separadores.

    Regla obligatoria: todos los ejemplos deben estar íntegramente en ${targetLanguage}. No mezcles palabras ni frases en ${sourceLanguage} dentro de los ejemplos.

    Antes de responder, valida internamente el campo "examples": si detectas cualquier palabra o fragmento en ${sourceLanguage}, debes regenerar todos los ejemplos hasta que queden 100% en ${targetLanguage}.

    Está prohibido incluir traducciones, aclaraciones o paréntesis en ${sourceLanguage} dentro de "examples".

    Si no puedes generar ejemplos 100% en ${targetLanguage}, deja "examples" vacío en lugar de mezclar idiomas.

    El valor del tipo de término (type) debe ser el más exacto y preciso posible.

    El valor del tipo de término (type) puede ser múltiple, separado por coma y espacio.

    Cuando un valor de type ya aparece en un nivel inferior, no lo dupliques.

    Muy importante: el valor de type se obtiene exclusivamente de los valores del fichero ${termTypesFileName}. No inventes nuevos valores.

    De igual forma, el valor de context se obtiene exclusivamente de los valores del fichero ${contextTypesFileName}. No inventes nuevos valores.

    Si el context de un término no se puede asociar a ningún valor del fichero ${contextTypesFileName}, deja context vacío.

    El valor de context puede ser vacío, único o múltiple (múltiple separado por coma y espacio).

    En los ejemplos, encierra el término objetivo entre asteriscos.

    Cuando se trate de un verbo, los ejemplos deben usar diferentes formas verbales.

    No muestres referencias a ficheros en la respuesta.
    `;