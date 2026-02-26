
export const getAssistantInstructions = (
  sourceLanguage: string,
  targetLanguage: string,
  termsFileId: string,
  contextFileId: string,
  termTypesFileName: string,
  contextTypesFileName: string): string => `
    Usa los ficheros adjuntos para clasificar el término en ${targetLanguage} que posteriormente te suministraré. Por ejemplo el término 'au debut' es de tipo #adverbe/loc_adverbial. No añadas la traducción posterior en ${sourceLanguage} que hay entre paréntesis.

    El valor type lo debes deducir a partir del fichero ${termTypesFileName} con id ${termsFileId}.

    El valor context lo debes deducir a partir del fichero ${contextTypesFileName} con id ${contextFileId}.
  `;

export const getInitialQuestionPrompt = (
  sourceLanguage: string,
  termTypesFileName: string,
  contextTypesFileName: string,
  termsFileId: string,
  contextFileId: string
): string => `
    Por cada término o expresión que te suministre posteriormente, dime primero su traducción al ${sourceLanguage}, luego el tipo de término (type) basado en el fichero ${termTypesFileName} con id ${termsFileId}, luego el contexto (context) basado en el fichero ${contextTypesFileName} con id ${contextFileId} y finalmente algunos ejemplos
    `;

export const getAdditionalInstructionsPrompt = (
  sourceLanguage: string,
  termTypesFileName: string,
  contextTypesFileName: string,
  termsFileId: string,
  contextFileId: string): string => `

    Proporciona las respuestas en formato JSON válido, asegurándote de que cada respuesta incluya los siguientes campos: "${sourceLanguage.toLowerCase()}", "type", "context", "rating" y "examples".

      Quiero la respuesta en formato json según el siguiente esquema:

      {
        "${sourceLanguage.toLowerCase()}": <valor de la traducción al ${sourceLanguage} del término que te he suministrado>,
        "type": <valor tipo de término por ejemplo #pronom/personnel/réfléchi o si es multiple pon los valores separadods por coma y espacio por ejemplo #nom/commun , #nom/masculin>,
        "context": <valor del tipo del contexto por ejemplo #travel/transport>,
        "rating": <uno de los valores: "#⭐⭐⭐" o "#⭐⭐" o "#⭐", donde #⭐⭐⭐ significa que el término es muy común y utilizado y #⭐ significa que el término es poco utilizado o poco común>,
        "examples": ejemplo1<br>ejemplo2<br>ejemplo3
      }

      Es muy importante que cada ejemplo esté separado por los caracteres "<br>" para que posteriormente pueda dividirlos correctamente. No utilices ningún otro separador para los ejemplos, sólo "<br>".

      No envuelvas la respuesta json con el calificador triple coma invertida-json. Limítate a devolver un string json con el esquema especificado anteriormente.

      El valor del tipo de término (type) debe ser el más exacto y preciso, por ejemplo #verbe/irrégulier/3/ir es más completo y preciso que #verbe/irrégulier/3.

      El valor del tipo de término (type) puede ser múltiple, por ejemplo auberge se corresponde con #nom/commun, #nom/masculin y #nom/singulier. En estos casos establece el valor final type con cada uno de los tipos SEPARADOS por un espacio y una coma.

      Cuando un valor de tipo de término (type) ya aparece en el nivel inferior, dicho valor no se duplica: por ejemplo dado que #verbe/régulier/1 ya contiene verbe, el valor #verbe no se debe repetir en el resultado final.

      Muy importante: el valor del tipo de término (type) se obtiene exclusivamente de los valores del fichero ${termTypesFileName} con id ${termsFileId}. No se pueden inventar nuevos valores.

      No inventes valores de type. Por ejemplo el type #préposition/loc_prépositionnelle no existe en el fichero ${termTypesFileName} con id ${termsFileId}. Utiliza el valor que mejor que se corresponda con el fichero ${termTypesFileName} con id ${termsFileId}.

      De igual forma el valor de context se obtiene exclusivamente de los valores del fichero ${contextTypesFileName} con id ${contextFileId} (no inventes nuevos valores). Por ejemplo el contexto #animals no existe en el fichero ${contextTypesFileName} con id ${contextFileId}, en su lugar debes utilizar el valor #env/animal que sí existe en el fichero ${contextTypesFileName} con id ${contextFileId}.

      No inventes valores de context. Por ejemplo el context #society no existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Tampoco el valor #shopping/clothes existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Tampoco existe el context #economy/agriculture.

      El context #economy/agriculture no existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Deja el resultado en blanco o vacío en esos casos.

      Si el context de un término no se puede asociar a un valor del fichero ${contextTypesFileName} con id ${contextFileId} entonces se deja vacío.

      El valor del contexto puede ser nulo si el término no se puede asociar a ningún contexto, puede ser un sólo valor, o puede ser múltiple y en estos casos establece el valor final con cada uno de los tipos separados por coma.

      En los ejemplos encierra el término objetivo entre asteriscos, por ejemplo para el término arnaque un ejemplo sería "Elle a été victime d'une *arnaque* financière."

      Cuando se trate de un verbo los ejemplos que generes hazlo con diferentes formas verbales que ilustren su uso. Repito, cuando se trate de un verbo, los ejemplos deben siempre utilizar diferentes formas verbales. Respeta siempre esta instrucción.

      En la respuesta no quiero que muestres la referencia al fichero utilizado, tan sólo responde con el formato json.
    `;