// game_logic.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. GAME STATE OBJECT ---
    const gameState = {
        neurons: 0,
        psychbucks: 0,
        neuronsPerClick: 1,
        currentBrainLevel: 0,
        passiveNeuronsPerSecond: 0,
        totalNeuronsGenerated: 0,
        neuronsSpentOnBrainUpgrades: 0,
        dopamineLevel: 0,
        gabaLevel: 0,
        factoryCount: 0,
        factoryCost: 10,
        passiveNeuroFuelMultiplier: 1,
        manualFuelMultiplier: 1,
        neuroFuel: 10,
        neuroFuelCost: 1,
        mindOps: 0,
        purchasedProjects: [],
        // anxietyMeter, timeAtHighDopamine, isAnxietyAttackActive are now in AnxietySystem
        questionsActuallyUnlocked: false,
        // isAmygdalaActive is effectively AnxietySystem.isAmygdalaFunctioning()
    }; 

    // --- 9. PROJECT SYSTEM MODULE ---
    const ProjectSystem = {
        projects: [],
        init(projectData) { this.projects = projectData.map(p => ({...p})); },
        renderProjects() {
            if(!projectsListDOM) return;
            projectsListDOM.innerHTML = '';
            this.projects.filter(p => !p.purchased && (!p.trigger || p.trigger())).forEach(p => {
                const div = document.createElement('div');
                div.className = 'project-item';
                const btn = document.createElement('button');
                btn.textContent = `Start (${p.cost} Ops)`;
                btn.disabled = gameState.mindOps < p.cost;
                btn.onclick = () => this.purchaseProject(p.id);
                div.innerHTML = `<h3>${p.title}</h3><p>${p.description}</p>`;
                div.appendChild(btn);
                projectsListDOM.appendChild(div);
            });
        },
        purchaseProject(id){
            const p = this.projects.find(pr => pr.id === id);
            if(!p || p.purchased || gameState.mindOps < p.cost) return;
            gameState.mindOps -= p.cost;
            if(typeof p.effect === 'function') p.effect();
            p.purchased = true;
            gameState.purchasedProjects.push(id);
            UIManager.logMessage(`Project completed: ${p.title}`, 'log-upgrade');
            this.renderProjects();
            UIManager.updateAllDisplays();
        },
        loadFromSave(saved){
            if(!saved) return;
            this.projects.forEach(p => { if(saved.includes(p.id)) { p.purchased = true; } });
        }
    };

    // --- 2. CONSTANTS ---
    const ANXIETY_THRESHOLD = 70; const ANXIETY_SUSTAINED_THRESHOLD = 60; const ANXIETY_TIME_LIMIT = 20; const MAX_ANXIETY = 100;
    const SCARY_STIMULI_INTERVAL_MS = 120000; const BASE_IQ = 80; const IQ_SCALE_FACTOR = 15; const MAX_LOG_MESSAGES = 20; const FACTORY_PRODUCTION_RATE = 0.5;
    const OPS_PER_NEURON = 0.01; const AUTO_SAVE_INTERVAL = 10000;
    const NEUROFUEL_PURCHASE_AMOUNT = 10;
    const FOOD_OPTIONS = [
        {emoji: '🍌', name: 'Banana'},
        {emoji: '🥪', name: 'Sandwich'},
        {emoji: '🍎', name: 'Apple'},
        {emoji: '🍪', name: 'Cookie'},
        {emoji: '🍕', name: 'Pizza slice'}
    ];

    // --- 3. DOM ELEMENTS ---
    const neuronsDisplayDOM = document.getElementById('neurons-display');
    const psychbucksDisplayDOM = document.getElementById('psychbucks-display');
    const iqDisplayDOM = document.getElementById('iq-display');
    const opsDisplayDOM = document.getElementById('ops-display');
    const clickButtonDOM = document.getElementById('click-button');
    const questionAreaSectionDOM = document.getElementById('question-area');
    const streakFeedbackAreaDOM = document.getElementById('streak-feedback-area');
    const questionTextElementDOM = document.getElementById('question-text');
    const answerOptionsElementDOM = document.getElementById('answer-options');
    const feedbackAreaDOM = document.getElementById('feedback-area');
    const upgradesListElementDOM = document.getElementById('upgrades-list');
    const neuronProliferationAreaDOM = document.getElementById('neuron-proliferation-area');
    const neuronProliferationUpgradesListDOM = document.getElementById('neuron-proliferation-upgrades-list');
    const hypothalamusControlsAreaDOM = document.getElementById('hypothalamus-controls-area');
    const dopamineSliderDOM = document.getElementById('dopamine-slider');
    const dopamineLevelDisplayDOM = document.getElementById('dopamine-level-display');
    const gabaSliderDOM = document.getElementById('gaba-slider');
    const gabaLevelDisplayDOM = document.getElementById('gaba-level-display');
    const anxietyStatusDisplayDOM = document.getElementById('anxiety-status');
    const infoBannerDOM = document.getElementById('info-banner');
    const scaryStimuliOverlayDOM = document.getElementById('scary-stimuli-overlay');
    const factoryAreaDOM = document.getElementById('factory-area');
    const factoryCountDOM = document.getElementById('factory-count');
    const factoryCostDOM = document.getElementById('factory-cost');
    const buyFactoryBtnDOM = document.getElementById('buy-factory-btn');
    const projectsListDOM = document.getElementById('projects-list');
    const neurofuelCountDOM = document.getElementById('neurofuel-count');
    const neurofuelCostDOM = document.getElementById('neurofuel-cost');
    const buyNeurofuelBtnDOM = document.getElementById('buy-neurofuel-btn');
    const infoButtonDOM = document.getElementById('info-button');
    const instructionsOverlayDOM = document.getElementById('instructions-overlay');
    const closeInstructionsBtnDOM = document.getElementById('close-instructions');
    const brainPopupDOM = document.getElementById('brain-popup');
    const closeBrainPopupBtnDOM = document.getElementById('close-brain-popup');
    const brainStatsChartDOM = document.getElementById('brain-stats-chart');

    const brainStatsData = { labels: [], neurons: [], fuel: [] };
    let brainChart = null;

    // --- 4. RAW DATA ---
    const coreUpgrades_raw_data = [
        { id: "biggerBrain1", name: "Brain Growth: Stage 1", costCurrency: "neurons", cost: 50, description: "Unlocks EASY Qs & Neuron Proliferation.", effectApplied: false, type: 'brain', action: () => { UIManager.logMessage("biggerBrain1 ACTION TRIGGERED!", "log-info"); gameState.currentBrainLevel = 1; UIManager.callUpdateBrainVisual(); QuestionSystem.setOverallUnlockState(true); QuestionSystem.unlockDifficultyLevel(0); if (neuronProliferationAreaDOM) { neuronProliferationAreaDOM.style.display = 'block'; UpgradeSystem.renderNeuronProliferationUpgrades(); } UIManager.logMessage("Brain Growth I: Easy Qs & Proliferation unlocked.", "log-unlock"); }},
        { id: "biggerBrain2", name: "Brain Growth: Stage 2", costCurrency: "neurons", cost: 250, description: "Unlocks MEDIUM Qs & Hypothalamus.", effectApplied: false, dependsOn: "biggerBrain1", type: 'brain', action: () => { gameState.currentBrainLevel = 2; UIManager.callUpdateBrainVisual(); QuestionSystem.unlockDifficultyLevel(1); if (hypothalamusControlsAreaDOM) hypothalamusControlsAreaDOM.style.display = 'block'; UIManager.logMessage("Brain Growth II: Medium Qs & Hypothalamus unlocked.", "log-unlock"); }},
        { id: "biggerBrain3", name: "Brain Growth: Stage 3", costCurrency: "neurons", cost: 1000, description: "Unlocks HARD Qs & Amygdala research.", effectApplied: false, dependsOn: "biggerBrain2", type: 'brain', action: () => { gameState.currentBrainLevel = 3; UIManager.callUpdateBrainVisual(); QuestionSystem.unlockDifficultyLevel(2); UIManager.logMessage("Brain Growth III: Hard Qs & Amygdala research.", "log-unlock"); UpgradeSystem.renderCoreUpgrades(); }},
        { id: "amygdalaActivation", name: "Activate Amygdala", costCurrency: "neurons", cost: 5000, psychbuckCost: 200, description: "Doubles passive neuron production. WARNING: Random stimuli.", effectApplied: false, dependsOn: "biggerBrain3", type: 'brain', action: () => { gameState.passiveNeuronsPerSecond = (gameState.passiveNeuronsPerSecond > 0 ? gameState.passiveNeuronsPerSecond : 0.1) * 2; AnxietySystem.activateAmygdala(); UIManager.logMessage("Amygdala activated! Production boosted.", "log-unlock"); /* UIManager.updateAllDisplays(); // Called by purchaseUpgrade */ }}
    ];
    const neuronProliferationUpgrades_raw_data = [
        { id: "prolifFactory", name: "Neuron Proliferation Factory", description: "Builds a facility for passive neuron growth (+0.5/sec).", costCurrency: "psychbucks", cost: 10, neuronBoost: 0.5, effectApplied: false, type: 'proliferation', action: () => { if(factoryAreaDOM) { factoryAreaDOM.style.display = 'block'; UIManager.updateFactoryDisplay(); } } },
        { id: "dendriticSprouting", name: "Dendritic Sprouting", description: "Increase passive neuron production by 0.1%.", costCurrency: "psychbucks", cost: 25, percentBoost: 0.1, effectApplied: false, dependsOn: "prolifFactory", type: 'proliferation' },
        { id: "myelination", name: "Myelination", description: "Boost production but consumes more fuel and raises anxiety.", costCurrency: "psychbucks", cost: 60, percentBoost: 20, extraFuel: 0.2, anxietyBoost: 5, effectApplied: false, dependsOn: "dendriticSprouting", type: 'proliferation' },
        { id: "metabolicEfficiency", name: "Metabolic Efficiency", description: "Cuts Neurofuel consumption by 50%.", costCurrency: "psychbucks", cost: 80, effectApplied: false, factoryRequirement: 4, type: 'proliferation', action: () => { gameState.manualFuelMultiplier *= 0.5; gameState.passiveNeuroFuelMultiplier *= 0.5; } },
    ];

    const projectData = [
        { id: 'efficiency', title: 'Neural Efficiency', description: 'Increase passive neuron production by 10%.', cost: 100, trigger: () => gameState.factoryCount >= 1, effect: () => { gameState.passiveNeuronsPerSecond *= 1.1; } },
        { id: 'automation', title: 'Autonomy Research', description: 'Clicks automatically once per second.', cost: 250, trigger: () => gameState.currentBrainLevel >= 1, effect: () => { setInterval(handleManualGeneration, 1000); } }
    ];

    // --- 5. UI MANAGER OBJECT ---
    const UIManager = {
        logMessage(message, type = 'log-info') { if (!infoBannerDOM) return; while (infoBannerDOM.childNodes.length >= MAX_LOG_MESSAGES) { infoBannerDOM.removeChild(infoBannerDOM.lastChild); } const el = document.createElement('p'); el.textContent = `[${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}] ${message}`; el.className = type; infoBannerDOM.insertBefore(el, infoBannerDOM.firstChild); infoBannerDOM.scrollTop = 0; },
        updateNeuronDisplay() { if (neuronsDisplayDOM) { neuronsDisplayDOM.textContent = `Neurons: ${Math.floor(gameState.neurons)}`; } },
        updatePsychbuckDisplay(rate) { if (psychbucksDisplayDOM) psychbucksDisplayDOM.textContent = `Psychbucks: ${Math.floor(gameState.psychbucks)} | Passive: ${rate.toFixed(1)}/s`; },
        updateOpsDisplay() { if (opsDisplayDOM) opsDisplayDOM.textContent = `Ops: ${Math.floor(gameState.mindOps)}`; },
        updateIQDisplay() { if (iqDisplayDOM) { const act = gameState.totalNeuronsGenerated + gameState.neuronsSpentOnBrainUpgrades + 1; const iq = BASE_IQ + Math.log10(act) * IQ_SCALE_FACTOR; iqDisplayDOM.textContent = `IQ: ${Math.floor(iq)}`; } },
        updateNeuroFuelDisplay() { if (neurofuelCountDOM && neurofuelCostDOM) { neurofuelCountDOM.textContent = Math.floor(gameState.neuroFuel); neurofuelCostDOM.textContent = Math.ceil(gameState.neuroFuelCost); } if(buyNeurofuelBtnDOM) buyNeurofuelBtnDOM.disabled = gameState.psychbucks < gameState.neuroFuelCost; if(document.getElementById('neurofuel-display')) document.getElementById('neurofuel-display').textContent = `Fuel: ${Math.floor(gameState.neuroFuel)}`; },
        updateAnxietyDisplay() { if (!anxietyStatusDisplayDOM) return; const ax = AnxietySystem.getAnxietyInfo(); let txt = `Anxiety: Normal (${ax.meter.toFixed(0)}%)`, clr = "green"; if (ax.isAttackActive){txt="Status: ANXIETY ATTACK!";clr="red";} else if (ax.activeStimuliCount>0 && ax.isAmygdalaSystemActive){txt=`Anxiety: Stimuli! (${ax.meter.toFixed(0)}%)`;clr="purple";} else if (ax.meter>ANXIETY_SUSTAINED_THRESHOLD){txt=`Anxiety: CRITICAL (${ax.meter.toFixed(0)}%)`;clr="orange";} else if (ax.meter>ANXIETY_SUSTAINED_THRESHOLD/2){txt=`Anxiety: Elevated (${ax.meter.toFixed(0)}%)`;clr="#CCCC00";} else if (ax.meter>0){txt=`Anxiety: Moderate (${ax.meter.toFixed(0)}%)`;clr="yellowgreen";} anxietyStatusDisplayDOM.textContent=txt; anxietyStatusDisplayDOM.style.color=clr=="g"?"green":clr=="r"?"red":clr=="purple"?"purple":clr=="orange"?"orange":clr=="#CCCC00"?"#CCCC00":clr=="yg"?"yellowgreen":"green";},
        updateQuestionAreaUIVisibility() { if (!questionAreaSectionDOM) {this.logMessage("Q Area DOM missing!","log-warning"); return;} if(gameState.questionsActuallyUnlocked){questionAreaSectionDOM.style.display='';this.logMessage("Q area VISIBLE.","log-info"); if(QuestionSystem.getCurrentQuestionIndex()===-1){this.logMessage("UIManager: Triggering QS loadNextQ.","log-info");QuestionSystem.loadNextQuestion();}}else{questionAreaSectionDOM.style.display='none';if(questionTextElementDOM)questionTextElementDOM.textContent="Upgrade brain for Qs.";if(answerOptionsElementDOM)answerOptionsElementDOM.innerHTML='';this.clearFeedbackAreas();this.logMessage("Q area HIDDEN.","log-info");}},
        displayQuestion(qData) { if(questionTextElementDOM)questionTextElementDOM.textContent=qData.text; if(answerOptionsElementDOM)answerOptionsElementDOM.innerHTML=""; qData.options.forEach((opt,idx)=>{const btn=document.createElement('button');btn.textContent=opt;btn.onclick=()=>QuestionSystem.handleAnswer(idx);if(answerOptionsElementDOM)answerOptionsElementDOM.appendChild(btn);});},
        displayFeedback(msg,type){if(type==='correct'||type==='incorrect'){if(feedbackAreaDOM){feedbackAreaDOM.textContent=msg;feedbackAreaDOM.style.color=type==='correct'?'green':'red';}}else if(type==='streak-bonus'||type==='streak-broken'){if(streakFeedbackAreaDOM){streakFeedbackAreaDOM.textContent=msg;streakFeedbackAreaDOM.className=type==='streak-bonus'?'streak-bonus-text':'streak-broken-text';}}},
        clearFeedbackAreas() { if(feedbackAreaDOM)feedbackAreaDOM.textContent=''; if(streakFeedbackAreaDOM){streakFeedbackAreaDOM.textContent='';streakFeedbackAreaDOM.className='';}},
        updateAllDisplays() { let effRate=gameState.passiveNeuronsPerSecond; if(AnxietySystem.isAttackCurrentlyActive())effRate=0;else if(gameState.currentBrainLevel>=2){effRate*=(1+(gameState.dopamineLevel/100)*0.2)*(1-(gameState.gabaLevel/100)*0.2);effRate=Math.max(0,effRate);} this.updateNeuronDisplay();this.updatePsychbuckDisplay(effRate);this.updateIQDisplay();this.updateOpsDisplay();this.updateNeuroFuelDisplay();this.updateAnxietyDisplay();this.updateFactoryDisplay();UpgradeSystem.updateUpgradeButtons();ProjectSystem.renderProjects();},
        callUpdateBrainVisual() { if(window.GameVisuals && typeof window.GameVisuals.updateBrainVisual === 'function'){window.GameVisuals.updateBrainVisual({level:gameState.currentBrainLevel,dopamine:gameState.dopamineLevel,gaba:gameState.gabaLevel});}},
        renderUpgradeList(upgsToRender,listElDOM,upgTypeStr){if(!listElDOM)return;listElDOM.innerHTML="";upgsToRender.forEach(upg=>{const itm=document.createElement('div');itm.classList.add('upgrade-item');if(upg.effectApplied){itm.classList.add('purchased');let sTxt="(Purchased)";if(upg.id==="amygdalaActivation"&&AnxietySystem.isAmygdalaFunctioning())sTxt="(Active)";itm.innerHTML=`<h3>${upg.name} ${sTxt}</h3><p>${upg.description}</p>`;}else{let cTxt=`${upg.cost} ${upg.costCurrency}`;if(upg.psychbuckCost)cTxt+=` & ${upg.psychbuckCost} Psychbucks`;itm.innerHTML=`<h3>${upg.name}</h3><p>${upg.description}</p><p>Cost: ${cTxt}</p><button data-upgrade-id="${upg.id}" data-upgrade-type="${upgTypeStr}">Purchase</button>`;const btn=itm.querySelector('button');if(btn)btn.onclick=(e)=>UpgradeSystem.purchaseUpgrade(e.target.dataset.upgradeId,e.target.dataset.upgradeType);}listElDOM.appendChild(itm);});},
        updateFactoryDisplay(){
            if(!factoryAreaDOM) return;
            if(factoryCountDOM) factoryCountDOM.textContent = gameState.factoryCount;
            if(factoryCostDOM) factoryCostDOM.textContent = Math.ceil(gameState.factoryCost);
            if(buyFactoryBtnDOM) buyFactoryBtnDOM.disabled = gameState.psychbucks < gameState.factoryCost;
        },
        updateSingleUpgradeButton(btnEl,canAfford){if(btnEl)btnEl.disabled=!canAfford;}
    };

    // --- 6. QUESTION SYSTEM MODULE OBJECT ---
    const QuestionSystem = {
        allQuestionsData: [], baseRewardsByDifficultyValue: { 0: 1, 1: 3, 2: 5 }, currentQuestionIndex: -1, difficultyUnlocked: -1, currentStreakCount: 0, currentStreakBonus: 0,
        init(questionsSourceArray) { this.allQuestionsData = questionsSourceArray || []; this.currentQuestionIndex = -1; this.difficultyUnlocked = -1; this.currentStreakCount = 0; this.currentStreakBonus = 0; UIManager.logMessage("QuestionSystem Initialized (" + this.allQuestionsData.length + " Qs).", "log-info"); if (this.allQuestionsData.length === 0 && questionsSourceArray && questionsSourceArray.length > 0) { UIManager.logMessage("QS WARNING: questionsSourceArray had items, but allQuestionsData is empty post-assignment!", "log-warning"); } else if (this.allQuestionsData.length === 0) { UIManager.logMessage("QS WARNING: Initialized with an empty questions array!", "log-warning"); } },
        getCurrentQuestionIndex() { return this.currentQuestionIndex; },
        setOverallUnlockState(isUnlocked) { gameState.questionsActuallyUnlocked = isUnlocked; UIManager.updateQuestionAreaUIVisibility(); },
        unlockDifficultyLevel(level) { this.difficultyUnlocked = Math.max(this.difficultyUnlocked, level); UIManager.logMessage(`${level === 0 ? 'Easy' : level === 1 ? 'Medium' : 'Hard'} questions available.`, 'log-info'); if (gameState.questionsActuallyUnlocked && this.currentQuestionIndex === -1) this.loadNextQuestion(); },
        loadNextQuestion() {
            if (!gameState.questionsActuallyUnlocked) { UIManager.updateQuestionAreaUIVisibility(); return; }
            const filteredQuestions = this.allQuestionsData.filter(q => q.difficulty <= this.difficultyUnlocked && (this.currentQuestionIndex === -1 || q.id !== this.allQuestionsData[this.currentQuestionIndex]?.id));
            if (filteredQuestions.length === 0) {
                if(questionTextElementDOM) questionTextElementDOM.textContent = (this.difficultyUnlocked < 2) ? "More questions at higher brain levels." : "All questions answered for this difficulty!";
                if(answerOptionsElementDOM) answerOptionsElementDOM.innerHTML = ''; UIManager.clearFeedbackAreas(); this.currentQuestionIndex = -1; UIManager.logMessage("QS: No suitable questions found.", "log-info"); return;
            }
            const randomIndex = Math.floor(Math.random() * filteredQuestions.length); const nextQuestionData = filteredQuestions[randomIndex];
            this.currentQuestionIndex = this.allQuestionsData.findIndex(q => q.id === nextQuestionData.id);
            if (this.currentQuestionIndex === -1) { console.error("QS Error finding Q by ID: ", nextQuestionData); UIManager.logMessage("CRIT QS: Error find Q by ID.", "log-warning"); if(questionTextElementDOM) questionTextElementDOM.textContent = "Error loading Q data."; if(answerOptionsElementDOM) answerOptionsElementDOM.innerHTML = ''; return; }
            UIManager.displayQuestion(this.allQuestionsData[this.currentQuestionIndex]); UIManager.clearFeedbackAreas(); UIManager.logMessage(`QS Loaded Q ID ${this.allQuestionsData[this.currentQuestionIndex].id}`, "log-info");
        },
        handleAnswer(selectedIndex) {
            if (!gameState.questionsActuallyUnlocked || this.currentQuestionIndex === -1 || !this.allQuestionsData[this.currentQuestionIndex]) return;
            const question = this.allQuestionsData[this.currentQuestionIndex]; const isCorrect = selectedIndex === question.correctAnswerIndex;
            if (isCorrect) {
                const baseReward = this.baseRewardsByDifficultyValue[question.difficulty] || 1; const actualPsychbucksEarned = baseReward + this.currentStreakBonus; gameState.psychbucks += actualPsychbucksEarned;
                UIManager.displayFeedback(`Correct!`, 'correct'); this.currentStreakCount++;
                UIManager.displayFeedback(this.currentStreakCount > 1 ? `Streak: ${this.currentStreakCount}! +${this.currentStreakBonus} bonus. Total: ${actualPsychbucksEarned} PB!` : `Streak Started! Total: ${actualPsychbucksEarned} PB!`, 'streak-bonus');
                UIManager.logMessage(`Correct: +${actualPsychbucksEarned} PB (Streak: ${this.currentStreakCount})`, 'log-info'); this.currentStreakBonus += baseReward;
            } else {
                UIManager.displayFeedback(`Incorrect. Correct was: ${question.options[question.correctAnswerIndex]}`, 'incorrect');
                UIManager.displayFeedback(this.currentStreakCount > 0 ? `Streak Broken! (Was ${this.currentStreakCount})` : "", 'streak-broken');
                if(this.currentStreakCount > 0) UIManager.logMessage(`Incorrect. Streak of ${this.currentStreakCount} broken.`, 'log-warning'); else UIManager.logMessage(`Incorrect.`, 'log-warning');
                this.currentStreakCount = 0; this.currentStreakBonus = 0;
                if (gameState.currentBrainLevel >= 2 && !AnxietySystem.isAttackCurrentlyActive()) {
                    let anxietyIncrease = 5 + (question.difficulty === 2 ? 5 : (question.difficulty === 1 ? 2 : 0));
                    AnxietySystem.increaseMeter(anxietyIncrease);
                }
            }
            this.currentQuestionIndex = -1; setTimeout(() => { this.loadNextQuestion(); UIManager.updateAllDisplays(); }, 1800);
        }
    };

    // --- 7. UPGRADE SYSTEM MODULE ---
    const UpgradeSystem = {
        coreUpgrades: [], neuronProliferationUpgrades: [],
        init(coreData, proliferationData) { this.coreUpgrades = coreData.map(u => ({ ...u, effectApplied: u.effectApplied || false })); this.neuronProliferationUpgrades = proliferationData.map(u => ({ ...u, effectApplied: u.effectApplied || false })); UIManager.logMessage("UpgradeSystem Initialized. Core: " + this.coreUpgrades.length + ", Prolif: " + this.neuronProliferationUpgrades.length, "log-info"); },
        getFilteredUpgrades(type) {
            const source = type === "core" ? this.coreUpgrades : this.neuronProliferationUpgrades;
            return source.filter(upg => {
                if (upg.dependsOn) {
                    const dep = this.coreUpgrades.find(u => u.id === upg.dependsOn) || this.neuronProliferationUpgrades.find(u => u.id === upg.dependsOn);
                    if (!dep || !dep.effectApplied) return false;
                }
                if (typeof upg.factoryRequirement === 'number' && gameState.factoryCount < upg.factoryRequirement) return false;
                return true;
            });
        },
        renderCoreUpgrades() { UIManager.logMessage("[UpgradeSystem] renderCoreUpgrades called.", "log-info"); const upgs = this.getFilteredUpgrades("core"); if (!upgradesListElementDOM) { UIManager.logMessage("[UpgradeSystem] ERROR: upgradesListElementDOM is null!", "log-warning"); return; } UIManager.renderUpgradeList(upgs, upgradesListElementDOM, "core"); this.updateUpgradeButtons(); },
        renderNeuronProliferationUpgrades() { UIManager.logMessage("[UpgradeSystem] renderNeuronProliferationUpgrades called.", "log-info"); if (neuronProliferationAreaDOM && neuronProliferationAreaDOM.style.display !== 'none') { const upgs = this.getFilteredUpgrades("proliferation"); if (!neuronProliferationUpgradesListDOM) { UIManager.logMessage("[UpgradeSystem] ERROR: neuronProliferationUpgradesListDOM is null!", "log-warning"); return; } UIManager.renderUpgradeList(upgs, neuronProliferationUpgradesListDOM, "proliferation"); this.updateUpgradeButtons(); } else { UIManager.logMessage("[UpgradeSystem] Neuron prolif area hidden, not rendering.", "log-info"); } },
        purchaseUpgrade(upgradeId, upgradeType) {
            let upg; const srcArr = upgradeType === "core" ? this.coreUpgrades : this.neuronProliferationUpgrades; upg = srcArr.find(u => u.id === upgradeId);
            if (!upg) { UIManager.logMessage(`Upg Err: "${upgradeId}" not found.`, "log-warning"); return; } if (upg.effectApplied) { UIManager.logMessage(`${upg.name} already purchased.`, "log-info"); return; }
            let canAfford = (upg.costCurrency === "neurons" && gameState.neurons >= upg.cost && (!upg.psychbuckCost || gameState.psychbucks >= upg.cost)) || (upg.costCurrency === "psychbucks" && gameState.psychbucks >= upg.cost);
            if (canAfford) {
                if(upg.costCurrency==="neurons")gameState.neurons-=upg.cost; if(upg.costCurrency==="psychbucks")gameState.psychbucks-=upg.cost; if(upg.psychbuckCost)gameState.psychbucks-=upg.psychbuckCost;
                if(upg.type==='brain')gameState.neuronsSpentOnBrainUpgrades+=upg.cost; upg.effectApplied=true;
                if(upgradeType==="proliferation"){ 
                    if(typeof upg.neuronBoost==='number'){ 
                        gameState.passiveNeuronsPerSecond+=upg.neuronBoost; 
                    }
                    if(typeof upg.percentBoost==='number'){ 
                        gameState.passiveNeuronsPerSecond*=1+(upg.percentBoost/100); 
                    }
                    if(typeof upg.extraFuel==='number'){ 
                        gameState.passiveNeuroFuelMultiplier*=1+upg.extraFuel; 
                    }
                    if(typeof upg.anxietyBoost==='number'){ 
                        AnxietySystem.increaseMeter(upg.anxietyBoost); 
                    }
                    gameState.passiveNeuronsPerSecond=parseFloat(gameState.passiveNeuronsPerSecond.toFixed(2));
                }
                const origUpgData=(upgradeType==="core"?coreUpgrades_raw_data:neuronProliferationUpgrades_raw_data).find(u=>u.id===upgradeId);
                if(origUpgData&&typeof origUpgData.action==='function'){origUpgData.action();}
                UIManager.logMessage(`Upgrade: ${upg.name} acquired.`, 'log-upgrade'); UIManager.updateAllDisplays();
                if(upgradeType==="core")this.renderCoreUpgrades();else this.renderNeuronProliferationUpgrades();
            } else { UIManager.logMessage(`Not enough for ${upg.name}.`, "log-warning"); }
        },
        getUpgradeData(type, brainLevelToFind) { const source = type === "core" ? this.coreUpgrades : this.neuronProliferationUpgrades; return source.find(upg => upg.type === 'brain' && (upg.id.match(/biggerBrain(\d+)/) && parseInt(upg.id.match(/biggerBrain(\d+)/)[1]) === brainLevelToFind)); },
        markUpgradeNotApplied(upgradeId, upgradeType) { const source = upgradeType === "core" ? this.coreUpgrades : this.neuronProliferationUpgrades; const upg = source.find(u => u.id === upgradeId); if (upg) { upg.effectApplied = false; UIManager.logMessage(`Reverted purchase status for ${upg.name}.`, "log-info"); } },
        updateUpgradeButtons() { const allBtns=document.querySelectorAll('#upgrades-list button[data-upgrade-id],#neuron-proliferation-upgrades-list button[data-upgrade-id]');allBtns.forEach(btn=>{const uid=btn.dataset.upgradeId;const utype=btn.dataset.upgradeType;let upg=utype==="core"?this.coreUpgrades.find(u=>u.id===uid):this.neuronProliferationUpgrades.find(u=>u.id===uid);if(upg&&!upg.effectApplied){let canAfford=(upg.costCurrency==="neurons"&&gameState.neurons>=upg.cost&&(!upg.psychbuckCost||gameState.psychbucks>=upg.psychbuckCost))||(upg.costCurrency==="psychbucks"&&gameState.psychbucks>=upg.cost);UIManager.updateSingleUpgradeButton(btn,canAfford);}else if(upg&&upg.effectApplied){UIManager.updateSingleUpgradeButton(btn,false);}else{UIManager.updateSingleUpgradeButton(btn,false);}}); }
    };

    // --- 8. ANXIETY SYSTEM MODULE ---
    const AnxietySystem = {
        meter: 0, timeAtHighDopamine: 0, isAttackActive: false, isAmygdalaOnline: false, scaryStimuliIntervalId: null, activeStimuliDOMElements: [],
        BASE_ANXIETY_INCREASE_FACTOR: 0.1, BASE_ANXIETY_DECREASE_FACTOR: 0.5,
        init() {this.meter=0;this.timeAtHighDopamine=0;this.isAttackActive=false;this.isAmygdalaOnline=false;if(this.scaryStimuliIntervalId)clearInterval(this.scaryStimuliIntervalId);this.scaryStimuliIntervalId=null;this.activeStimuliDOMElements.forEach(el=>el.remove());this.activeStimuliDOMElements=[];UIManager.logMessage("AnxietySystem Initialized.","log-info");},
        getAnxietyInfo(){return{meter:this.meter,isAttackActive:this.isAttackActive,activeStimuliCount:this.activeStimuliDOMElements.length,isAmygdalaSystemActive:this.isAmygdalaOnline};},
        isAttackCurrentlyActive(){return this.isAttackActive;},
        isAmygdalaFunctioning(){return this.isAmygdalaOnline;}, // Changed from isAmygdalaSystemActive to isAmygdalaOnline
        activateAmygdala(){if(this.isAmygdalaOnline)return;this.isAmygdalaOnline=true;this._startScaryStimuliTimer();UIManager.logMessage("AnxietySystem: Amygdala online.","log-info");},
        increaseMeter(amount){if(!this.isAttackActive){this.meter=Math.min(MAX_ANXIETY,this.meter+amount);UIManager.logMessage(`Anxiety meter stress: +${amount}.`,'log-info');}},
        update(){if(this.isAttackActive){if(gameState.gabaLevel>0){this.meter=Math.max(0,this.meter-(gameState.gabaLevel/20));if(this.meter<=0){this.isAttackActive=false;this.timeAtHighDopamine=0;UIManager.logMessage("Anxiety subsided.","log-info");}}return;}let currentAnxietyChange=0;if(gameState.currentBrainLevel>=2&&gameState.dopamineLevel>ANXIETY_THRESHOLD&&(gameState.gabaLevel<gameState.dopamineLevel*0.4||gameState.gabaLevel<20)){this.timeAtHighDopamine++;currentAnxietyChange=(gameState.dopamineLevel/25)*this.BASE_ANXIETY_INCREASE_FACTOR;if(this.isAmygdalaOnline&&this.activeStimuliDOMElements.length>0){currentAnxietyChange*=2;}}else{this.timeAtHighDopamine=Math.max(0,this.timeAtHighDopamine-1);currentAnxietyChange=-(this.BASE_ANXIETY_DECREASE_FACTOR+(gameState.gabaLevel/15));}this.meter=Math.min(MAX_ANXIETY,Math.max(0,this.meter+currentAnxietyChange));if(this.timeAtHighDopamine>=ANXIETY_TIME_LIMIT&&this.meter>ANXIETY_SUSTAINED_THRESHOLD&&!this.isAttackActive){this._triggerAttack();}},
        _triggerAttack(){if(this.isAttackActive)return;this.isAttackActive=true;this.timeAtHighDopamine=0;UIManager.logMessage("ANXIETY ATTACK! Production halted. Stability compromised!","log-warning");gameState.neurons=Math.floor(gameState.neurons*0.8);let prevBrainLvl=gameState.currentBrainLevel;gameState.currentBrainLevel=Math.max(0,gameState.currentBrainLevel-1);if(prevBrainLvl>gameState.currentBrainLevel){const downgradedUpg=UpgradeSystem.getUpgradeData("core",prevBrainLvl);if(downgradedUpg){UpgradeSystem.markUpgradeNotApplied(downgradedUpg.id,"core");UIManager.logMessage(`Stability lost. ${downgradedUpg.name} requires reinforcement.`,"log-warning");}}UIManager.callUpdateBrainVisual();UpgradeSystem.renderCoreUpgrades();UIManager.updateAnxietyDisplay();UIManager.updateAllDisplays();},
        _startScaryStimuliTimer(){if(this.scaryStimuliIntervalId)clearInterval(this.scaryStimuliIntervalId);this.scaryStimuliIntervalId=setInterval(()=>this._triggerScaryStimuliBatch(),SCARY_STIMULI_INTERVAL_MS);UIManager.logMessage("Amygdala awareness protocol initiated.","log-warning");},
        _triggerScaryStimuliBatch(){if(!this.isAmygdalaOnline||document.hidden)return;this.activeStimuliDOMElements.forEach(sD=>sD.remove());this.activeStimuliDOMElements=[];const numS=Math.floor(Math.random()*3)+3;UIManager.logMessage(`Awareness: ${numS} abrupt stimuli!`,"log-warning");for(let i=0;i<numS;i++)setTimeout(()=>this._createScaryStimulus(),i*150);},
        _createScaryStimulus(){if(!scaryStimuliOverlayDOM)return;const sD=document.createElement('div');const sT=["DANGER!","FEAR!","WATCH OUT!","PANIC!","THREAT!","ALERT!","INTRUSION!"];sD.textContent=sT[Math.floor(Math.random()*sT.length)];sD.className='scary-stimulus-popup';const oW=scaryStimuliOverlayDOM.offsetWidth,oH=scaryStimuliOverlayDOM.offsetHeight,pW=150,pH=60;sD.style.left=`${Math.random()*Math.max(0,oW-pW)}px`;sD.style.top=`${Math.random()*Math.max(0,oH-pH)}px`;sD.style.opacity='0';sD.style.transform='scale(0.5)';sD.onclick=()=>this._dismissScaryStimulus(sD);this.activeStimuliDOMElements.push(sD);scaryStimuliOverlayDOM.appendChild(sD);setTimeout(()=>{sD.style.opacity='1';sD.style.transform='scale(1)';},50);},
        _dismissScaryStimulus(sD){sD.style.opacity='0';sD.style.transform='scale(0.7)';setTimeout(()=>{try{sD.remove();this.activeStimuliDOMElements=this.activeStimuliDOMElements.filter(s=>s!==sD);if(this.activeStimuliDOMElements.length===0)UIManager.logMessage("Stimuli cleared. Focus returning.","log-info");}catch(e){console.error("Err dismiss stimulus:",e);}},300);}
    };

    // =======================================================================
    // 9. HELPER FUNCTIONS (Event Handlers, etc. - DEFINED BEFORE attachEventListeners and initGame)
    // =======================================================================
    function handleManualGeneration() {
        console.log("[DEBUG] handleManualGeneration CALLED"); UIManager.logMessage("handleManualGeneration called.", "log-info");
        if (AnxietySystem.isAttackCurrentlyActive()) { console.log("[DEBUG] Manual generation BLOCKED by anxiety attack."); UIManager.logMessage("Brain recovering... clicking disabled (Anxiety Active).", "log-warning"); return; }
        const possible = Math.min(gameState.neuronsPerClick, gameState.neuroFuel / gameState.manualFuelMultiplier);
        if(possible <= 0){ UIManager.logMessage('Out of NeuroFuel!', 'log-warning'); return; }
        let neuronsBeforeClick = gameState.neurons; gameState.neurons += possible; gameState.totalNeuronsGenerated += possible;
        gameState.mindOps += possible * OPS_PER_NEURON;
        gameState.neuroFuel -= possible * gameState.manualFuelMultiplier;
        console.log(`[DEBUG] Neurons: ${neuronsBeforeClick} -> ${gameState.neurons}, PerClick: ${possible}`); UIManager.logMessage(`Neuron click: ${neuronsBeforeClick} -> ${gameState.neurons}`, "log-info");
        UIManager.updateAllDisplays();
    }
    function handleBuyProliferationFactory(){
        if(gameState.psychbucks >= gameState.factoryCost){
            gameState.psychbucks -= gameState.factoryCost;
            gameState.factoryCount += 1;
            gameState.passiveNeuronsPerSecond += FACTORY_PRODUCTION_RATE;
            gameState.factoryCost *= 1.15;
            UIManager.logMessage(`Proliferation Factory purchased! Total: ${gameState.factoryCount}`, 'log-upgrade');
            // After buying a factory, new upgrades may unlock
            UpgradeSystem.renderNeuronProliferationUpgrades();
        } else {
            UIManager.logMessage('Not enough Psychbucks for factory.', 'log-warning');
        }
        UIManager.updateAllDisplays();
    }

    function handleBuyNeurofuel(){
        if(gameState.psychbucks >= gameState.neuroFuelCost){
            gameState.psychbucks -= gameState.neuroFuelCost;
            gameState.neuroFuel += NEUROFUEL_PURCHASE_AMOUNT;
            const item = FOOD_OPTIONS[Math.floor(Math.random()*FOOD_OPTIONS.length)];
            UIManager.logMessage(`Purchased ${item.emoji} ${item.name}!`, 'log-upgrade');
            gameState.neuroFuelCost *= 1.05;
        } else {
            UIManager.logMessage('Not enough Psychbucks for food.', 'log-warning');
        }
        UIManager.updateAllDisplays();
    }
    function handleDopamineSlider(event) { gameState.dopamineLevel = parseInt(event.target.value); if(dopamineLevelDisplayDOM) dopamineLevelDisplayDOM.textContent = gameState.dopamineLevel; UIManager.callUpdateBrainVisual(); UIManager.updateAllDisplays(); }
    function handleGabaSlider(event) { gameState.gabaLevel = parseInt(event.target.value); if(gabaLevelDisplayDOM) gabaLevelDisplayDOM.textContent = gameState.gabaLevel; UIManager.callUpdateBrainVisual(); UIManager.updateAllDisplays(); }

    function openBrainPopup(){
        if(!brainPopupDOM) return;
        if(!brainChart && brainStatsChartDOM && window.Chart){
            const ctx = brainStatsChartDOM.getContext('2d');
            brainChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: brainStatsData.labels,
                    datasets: [
                        { label: 'Neurons', data: brainStatsData.neurons, borderColor: 'blue', fill: false },
                        { label: 'Fuel', data: brainStatsData.fuel, borderColor: 'orange', fill: false }
                    ]
                },
                options: { animation: false }
            });
        }
        brainPopupDOM.style.display = 'flex';
    }

    function closeBrainPopup(){
        if(brainPopupDOM) brainPopupDOM.style.display = 'none';
    }

    function saveGame() {
        const save = {
            gameState,
            coreUpgrades: UpgradeSystem.coreUpgrades,
            proliferationUpgrades: UpgradeSystem.neuronProliferationUpgrades,
            purchasedProjects: gameState.purchasedProjects
        };
        localStorage.setItem('up_save', JSON.stringify(save));
    }

    function loadGame() {
        const raw = localStorage.getItem('up_save');
        if(!raw) return;
        try {
            const data = JSON.parse(raw);
            Object.assign(gameState, data.gameState || {});
            if(Array.isArray(data.coreUpgrades)) UpgradeSystem.coreUpgrades = data.coreUpgrades;
            if(Array.isArray(data.proliferationUpgrades)) UpgradeSystem.neuronProliferationUpgrades = data.proliferationUpgrades;
            ProjectSystem.loadFromSave(data.purchasedProjects);
        } catch(e) { console.error('Load failed', e); }
    }

    function resetGame() {
        localStorage.removeItem('up_save');
        location.reload();
    }

    // =======================================================================
    // 10. GAME LOOP
    // =======================================================================
    function gameLoop() {
        AnxietySystem.update(); // AnxietySystem now accesses gameState directly for dopamine, gaba, currentBrainLevel
        let calculatedPassiveRateThisTick = gameState.passiveNeuronsPerSecond;
        if (AnxietySystem.isAttackCurrentlyActive()) { calculatedPassiveRateThisTick = 0; }
        else if (gameState.currentBrainLevel >= 2) {
            let dMultiplier = 1 + (gameState.dopamineLevel / 100) * 0.20;
            let gMultiplier = 1 - (gameState.gabaLevel / 100) * 0.20;
            calculatedPassiveRateThisTick *= dMultiplier * gMultiplier;
            calculatedPassiveRateThisTick = Math.max(0, calculatedPassiveRateThisTick);
        }
        if(gameState.neuroFuel > 0){
            const maxPossible = gameState.neuroFuel / gameState.passiveNeuroFuelMultiplier;
            const possible = Math.min(calculatedPassiveRateThisTick, maxPossible);
            gameState.neurons += possible;
            gameState.totalNeuronsGenerated += possible;
            gameState.mindOps += possible * OPS_PER_NEURON;
            gameState.neuroFuel -= possible * gameState.passiveNeuroFuelMultiplier;
        }
        UIManager.updateAllDisplays();
        brainStatsData.labels.push('');
        brainStatsData.neurons.push(gameState.neurons);
        brainStatsData.fuel.push(gameState.neuroFuel);
        if(brainStatsData.labels.length > 50){
            brainStatsData.labels.shift();
            brainStatsData.neurons.shift();
            brainStatsData.fuel.shift();
        }
        if(brainChart) brainChart.update();
    }

    // =======================================================================
    // 11. EVENT LISTENERS ATTACHMENT
    // =======================================================================
    function attachEventListeners() {
        console.log("Attaching event listeners...");
        if (clickButtonDOM) { clickButtonDOM.addEventListener('click', handleManualGeneration); console.log("Listener attached to clickButtonDOM."); UIManager.logMessage("Click listener ready.", "log-info"); }
        else { console.error("clickButtonDOM is null."); UIManager.logMessage("ERR: Click button not found!", "log-warning"); }
        if (dopamineSliderDOM) dopamineSliderDOM.addEventListener('input', handleDopamineSlider); else console.warn("Dopamine slider not found.");
        if (gabaSliderDOM) gabaSliderDOM.addEventListener('input', handleGabaSlider); else console.warn("GABA slider not found.");
        if (buyFactoryBtnDOM) buyFactoryBtnDOM.addEventListener('click', handleBuyProliferationFactory);
        if (buyNeurofuelBtnDOM) buyNeurofuelBtnDOM.addEventListener('click', handleBuyNeurofuel);
        const threeContainerDOM = document.getElementById('threejs-canvas-container');
        if (threeContainerDOM) threeContainerDOM.addEventListener('click', openBrainPopup);
        if (closeBrainPopupBtnDOM) closeBrainPopupBtnDOM.addEventListener('click', closeBrainPopup);
        if (infoButtonDOM) infoButtonDOM.addEventListener('click', () => {
            if (instructionsOverlayDOM) instructionsOverlayDOM.style.display = 'flex';
        });
        if (closeInstructionsBtnDOM) closeInstructionsBtnDOM.addEventListener('click', () => {
            if (instructionsOverlayDOM) instructionsOverlayDOM.style.display = 'none';
        });
        const btnDebugNeurons = document.getElementById('debug-add-neurons');
        const btnDebugPsychbucks = document.getElementById('debug-add-psychbucks');
        const btnDebugReset = document.getElementById('debug-reset-game');
        if (btnDebugNeurons) btnDebugNeurons.addEventListener('click', () => { gameState.neurons += 1000; UIManager.updateAllDisplays(); UIManager.logMessage("DEBUG: +1000 Neurons", "log-info"); }); else console.warn("Debug neurons button not found.");
        if (btnDebugPsychbucks) btnDebugPsychbucks.addEventListener('click', () => { gameState.psychbucks += 100; UIManager.updateAllDisplays(); UIManager.logMessage("DEBUG: +100 Psychbucks", "log-info"); }); else console.warn("Debug psychbucks button not found.");
        if (btnDebugReset) btnDebugReset.addEventListener('click', resetGame); else console.warn("Debug reset button not found.");
    }

    // =======================================================================
    // 12. INIT GAME FUNCTION
    // =======================================================================
    async function initGame() {
        UIManager.logMessage("Initializing Game...", "log-info"); console.log("initGame started");
        try {
            UIManager.logMessage("Fetching questions...", "log-info");
            const response = await fetch('questions.json');
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} fetching questions.json`); }
            const fetchedQuestions = await response.json();
            QuestionSystem.init(fetchedQuestions);
            UIManager.logMessage(`Fetched ${fetchedQuestions.length} questions.`, "log-info");
        } catch (error) {
            console.error("Failed to load questions.json:", error);
            UIManager.logMessage("CRITICAL ERROR: Failed to load questions. Questions will not work.", "log-warning");
            QuestionSystem.init([]);
        }
        UpgradeSystem.init(coreUpgrades_raw_data, neuronProliferationUpgrades_raw_data);
        ProjectSystem.init(projectData);
        AnxietySystem.init();
        loadGame();
        gameState.questionsActuallyUnlocked = false;
        UIManager.updateQuestionAreaUIVisibility();
        UpgradeSystem.renderCoreUpgrades();
        UpgradeSystem.renderNeuronProliferationUpgrades();
        attachEventListeners();
        UIManager.updateFactoryDisplay();
        UIManager.updateNeuroFuelDisplay();
        UIManager.updateAllDisplays();
        UIManager.logMessage("Welcome to Universal Psychology!", "log-info");
        setInterval(gameLoop, 1000);
        setInterval(saveGame, AUTO_SAVE_INTERVAL);
        console.log("initGame finished");
    }

    // =======================================================================
    // 13. START THE GAME
    // =======================================================================
    initGame();
});
