/* ---------------- API: Description ---------------- */
app.get("/api/description",async(req,res)=>{
  const topic=req.query.topic||"cosmetics";

  let pick;
  if(topic==="cosmetics") pick=TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  else if(topic==="music") pick=TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  else if(topic==="politics") pick=TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  else pick=TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];

  const persona=randomPersona();
  const description=await makeDescription(topic,pick);

  let mimicLine=null;
  if(topic==="music"){
    const feature = artistFeatures[pick.artist] || "a dramatic playful expression with improvised hand gestures";
    mimicLine=`🎶✨ I tried ${feature} like ${pick.artist} 😅.`;
  }

  // ✅ Return chosen product explicitly
  res.json({
    brand:pick.brand||pick.artist||pick.issue||"323aidrop",
    product:pick.product||pick.track||pick.keyword||pick.concept,
    persona,
    description,
    mimicLine,
    hashtags:["#NowTrending"],
    isDaily:false
  });
});

/* ---------------- API: Image ---------------- */
app.get("/api/image",async(req,res)=>{
  const topic=req.query.topic||"cosmetics";

  // ✅ Use product + brand from query instead of picking again
  const brand=req.query.brand;
  const product=req.query.product;

  if(!brand || !product){
    return res.status(400).json({error:"brand and product are required"});
  }

  const persona=randomPersona();
  const imageUrl=await generateImageUrl(topic,{brand,product},persona);

  res.json({ image:imageUrl });
});