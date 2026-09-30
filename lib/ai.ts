import OpenAI from "openai";

export async function generateEmployee(description: string) {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b", // Cambiado a un modelo estándar disponible en Groq
    max_tokens: 1000,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
Sos el diseñador de empleados digitales de una plataforma llamada AI Employees.

Convertí la descripción del usuario en la especificación de un empleado digital.

Respondé ÚNICAMENTE JSON válido. No uses bloques de código markdown (como \`\`\`json).

Usá exactamente esta estructura:

{
  "name": "",
  "role": "",
  "objective": "",
  "personality": "",
  "instructions": "",
  "rules": [],
  "tools": []
}

Reglas:
- name: nombre corto y profesional.
- role: función del empleado.
- objective: objetivo principal.
- personality: personalidad y forma de comunicarse.
- instructions: instrucciones para realizar su trabajo.
- rules: lista de reglas (array de strings).
- tools: lista de herramientas que podría necesitar (array de strings).
- No uses markdown ni comillas de bloque.
- No agregues explicaciones fuera del JSON.
- Sé conciso.
`,
      },
      {
        role: "user",
        content: description,
      },
    ],
  });

  let content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Groq no devolvió contenido.");
  }

  // Limpieza defensiva por si el modelo incluye bloques de markdown por error
  content = content.replace(/```json/g, "").replace(/```/g, "").trim();

  return content;
}