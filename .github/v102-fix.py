from pathlib import Path
p=Path('server.js')
s=p.read_text()
old='''  try{\n    const response = await openai.chat.completions.create({\n      model:"gpt-4o-mini",\n      temperature:0.65,'''
new='''  try{\n    const connectionCheck = await validateBeingConnections(required.slice(4));\n    if(!connectionCheck.valid) return res.status(400).json({ error:connectionCheck.error });\n    const response = await openai.chat.completions.create({\n      model:"gpt-4o-mini",\n      temperature:0.65,'''
if old not in s: raise SystemExit('bio validation anchor missing')
s=s.replace(old,new,1)
s=s.replace('name, bio, category, word1, word2, word3, connection1, connection2, connection3, connection1, connection2, connection3','name, bio, category, word1, word2, word3, connection1, connection2, connection3',1)
old='''  const required = [photo, name, best_current_choice, category, word1, word2, word3];\n\n  if (required.some(value => !String(value || "").trim())) {\n    return res.status(400).json({ error: "All AI Being fields are required." });\n  }'''
new='''  const required = [photo, name, best_current_choice, category, word1, word2, word3, connection1, connection2, connection3];\n\n  if (required.some(value => !String(value || "").trim())) {\n    return res.status(400).json({ error: "Complete every required HUMAN field." });\n  }'''
if old not in s: raise SystemExit('put required anchor missing')
s=s.replace(old,new,1)
old='''Return JSON only with exactly these keys:\nname, bio, category, word1, word2, word3\n\nRules:\n- Preserve meaning and proper names. Never invent facts.'''
new='''Return JSON only with exactly these keys:\nname, bio, category, word1, word2, word3, connection1, connection2, connection3\n\nRules:\n- Preserve meaning and proper names. Never invent facts.\n- Preserve connection1, connection2, and connection3 as short object or place names.'''
if old not in s: raise SystemExit('put prompt anchor missing')
s=s.replace(old,new,1)
s=s.replace('error: "AI Being not found."','error: "HUMAN not found."')
s=s.replace('error: "Could not rewrite the AI Being profile in English. Please try again."','error: "Could not rewrite the HUMAN profile in English. Please try again."')
p.write_text(s)
