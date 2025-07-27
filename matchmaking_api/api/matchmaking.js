import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Missing startup description' });
  }

  try {
    const { data: problems, error } = await supabase
      .from('problems')
      .select('id, title, description, location')
      .limit(20);

    if (error) throw error;

    const formattedProblems = problems
      .map(
        (p, i) => \`Problem \${i + 1}:
Title: \${p.title}
Location: \${p.location}
Description: \${p.description}\`
      )
      .join("\n\n");

    const prompt = \`A startup has submitted the following idea:
"\""
\${description}
"\""

Here are real-world problems reported from different parts of the world:

\${formattedProblems}

Rank the problems from most to least relevant based on how well the startup could help solve them. Return an ordered list with short reasoning.\`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a matchmaking assistant between startups and real-world problems.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    const rankedList = completion.choices[0].message.content;
    return res.status(200).json({ result: rankedList });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}