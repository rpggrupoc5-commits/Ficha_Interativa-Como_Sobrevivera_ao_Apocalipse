import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAdjZy-eaJmeGlvvEMTQXDZmy5WOOKNoGg",
  authDomain: "painel-ficha-apocalipse.firebaseapp.com",
  projectId: "painel-ficha-apocalipse",
  storageBucket: "painel-ficha-apocalipse.firebasestorage.app",
  messagingSenderId: "277003324514",
  appId: "1:277003324514:web:80644b98aa895afdac553b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioAtual = null;
const emailMestre = "rpgrupoc5@gmail.com"; // <--- SEU E-MAIL DE MESTRE AQUI

// --- LÓGICA DOS ATRIBUTOS (Ação%) ---
const forca = document.getElementById('forca');
const destreza = document.getElementById('destreza');
const forcaAcao = document.getElementById('forca-acao');
const destrezaAcao = document.getElementById('destreza-acao');

function calcular() {
    if (forca.value) forcaAcao.value = parseInt(forca.value) * 3;
    else forcaAcao.value = '';
    if (destreza.value) destrezaAcao.value = parseInt(destreza.value) * 3;
    else destrezaAcao.value = '';
}
if(forca) forca.addEventListener('input', calcular);
if(destreza) destreza.addEventListener('input', calcular);

// --- SISTEMA DE LOGIN E CADASTRO ---
const telaLogin = document.getElementById('tela-login');
const sitePrincipal = document.getElementById('site-principal');
const mensagemErro = document.getElementById('mensagem-erro');

document.getElementById('btn-entrar').onclick = () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    signInWithEmailAndPassword(auth, email, senha)
        .catch((error) => {
            mensagemErro.innerText = "Erro: E-mail ou senha incorretos.";
            mensagemErro.classList.remove('hidden');
        });
};

document.getElementById('btn-cadastrar').onclick = () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    createUserWithEmailAndPassword(auth, email, senha)
        .then(() => {
            alert("Conta criada com sucesso! Bem-vindo ao apocalipse.");
        })
        .catch((error) => {
            mensagemErro.innerText = "Erro: " + error.message;
            mensagemErro.classList.remove('hidden');
        });
};

document.getElementById('btn-sair').onclick = () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        telaLogin.classList.add('hidden');
        sitePrincipal.classList.remove('hidden');
        
        // Verifica se é o mestre e mostra o botão
        if (user.email === emailMestre) {
            const btnMestre = document.getElementById('btn-painel-mestre');
            btnMestre.classList.remove('hidden');
            btnMestre.style.display = 'block'; // Força a aparecer
        }
        
        carregarFicha();
    } else {
        usuarioAtual = null;
        telaLogin.classList.remove('hidden');
        sitePrincipal.classList.add('hidden');
    }
});

// --- UPLOAD E MODAL ---
window.abrirSeletor = function(callback) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => callback(event.target.result);
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

window.uploadFoto = function(elemento) {
    window.abrirSeletor((imgBase64) => {
        elemento.innerHTML = `<img src="${imgBase64}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center; position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;">`;
        elemento.onclick = null;
        const btn = document.createElement('div');
        btn.innerHTML = 'X';
        btn.className = 'absolute top-2 right-2 bg-red-800 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer z-20 text-sm font-bold shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none';
        btn.onclick = (e) => { 
            e.stopPropagation(); 
            elemento.innerHTML = '<i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i><span>FOTO DO<br>PERSONAGEM</span><div class="texto-proporcao">PROPORÇÃO IDEAL: 9x16</div>'; 
            elemento.onclick = () => window.uploadFoto(elemento);
        };
        elemento.appendChild(btn);
        let timer;
        elemento.onmouseenter = () => { clearTimeout(timer); btn.classList.remove('opacity-0'); btn.classList.add('opacity-100'); };
        elemento.onmouseleave = () => { timer = setTimeout(() => { btn.classList.add('opacity-0'); btn.classList.remove('opacity-100'); }, 1500); };
    });
}

const gridInv = document.getElementById('inventario');
const espacosEl = document.getElementById('espacos');
const pesoEl = document.getElementById('peso-total');
let quadradoAtual = null;
let imagemAtualBase64 = null;

function recalcularPesoTotal() {
    let pesoTotal = 0;
    document.querySelectorAll('.item-adicionado').forEach(item => {
        const qtd = parseFloat(item.dataset.qtd) || 1;
        const pesoStr = (item.dataset.peso || "0").toString().replace(',', '.');
        pesoTotal += (qtd * (parseFloat(pesoStr) || 0));
    });
    if(pesoEl) pesoEl.innerText = pesoTotal.toFixed(2);
    if(espacosEl) espacosEl.innerText = document.querySelectorAll('#inventario .item-adicionado').length;
}

const modalHTML = `
    <div id="modal-item" class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
        <div class="painel-papel p-6 rounded-lg w-[400px] flex flex-col gap-3 relative">
            <h3 class="fonte-titulo text-2xl text-[#111] border-b border-black/30 pb-2 mb-2">DADOS DO ITEM</h3>
            <div class="flex gap-4">
                <div id="modal-preview" class="w-24 h-24 rounded flex flex-col justify-center items-center relative overflow-hidden text-black/30 border-2 border-dashed border-[#3a2e27] bg-black/10">
                    <i class="fa-solid fa-camera text-2xl mb-1"></i>
                    <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
                </div>
                <div class="flex-1 flex flex-col gap-2">
                    <label class="flex flex-col text-sm font-bold text-[#111]">Nome do Item: <input type="text" id="modal-nome" class="input-campo p-2"></label>
                    <button id="btn-upload" class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm"><i class="fa-solid fa-camera"></i> Escolher Imagem</button>
                </div>
            </div>
            <div class="flex gap-2">
                <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Quantidade: <input type="number" id="modal-qtd" value="1" class="input-campo p-2"></label>
                <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Peso Unit. (kg): <input type="text" id="modal-peso" class="input-campo p-2" placeholder="Ex: 0.5"></label>
            </div>
            <label class="flex flex-col text-sm font-bold text-[#111]">Descrição: <textarea id="modal-desc" class="input-campo p-2 resize-none h-16"></textarea></label>
            <div class="flex justify-between mt-2 gap-2">
                <button id="btn-excluir" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700 hidden">Excluir</button>
                <button id="btn-cancelar" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700">Cancelar</button>
                <button id="btn-salvar-item" class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1 hover:brightness-125">Salvar</button>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

const modal = document.getElementById('modal-item');
const modalPreview = document.getElementById('modal-preview');
const inputNome = document.getElementById('modal-nome');
const inputQtd = document.getElementById('modal-qtd');
const inputPeso = document.getElementById('modal-peso');
const inputDesc = document.getElementById('modal-desc');
const btnExcluir = document.getElementById('btn-excluir');
const btnCancelar = document.getElementById('btn-cancelar');
const btnSalvarItem = document.getElementById('btn-salvar-item');
const btnUpload = document.getElementById('btn-upload');

function atualizarPreviewModal() {
    if (imagemAtualBase64) {
        modalPreview.innerHTML = `<img src="${imagemAtualBase64}" style="width: 100%; height: 100%; object-fit: contain; padding: 4px;"><button id="btn-remover-img-modal" class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">X</button>`;
        modalPreview.classList.remove('border-dashed'); modalPreview.classList.add('border-solid');
        document.getElementById('btn-remover-img-modal').onclick = (e) => { e.preventDefault(); imagemAtualBase64 = null; atualizarPreviewModal(); };
    } else {
        modalPreview.innerHTML = `<i class="fa-solid fa-camera text-2xl mb-1"></i><span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>`;
        modalPreview.classList.add('border-dashed'); modalPreview.classList.remove('border-solid');
    }
}

function abrirModal(q, dados = null) {
    quadradoAtual = q;
    if (dados && dados.nome) {
        inputNome.value = dados.nome; inputQtd.value = dados.qtd; inputPeso.value = dados.peso; inputDesc.value = dados.desc || "";
        imagemAtualBase64 = dados.img; btnExcluir.classList.remove('hidden');
        document.querySelector('#modal-item h3').innerText = "EDITAR ITEM"; btnSalvarItem.innerText = "SALVAR";
    } else {
        inputNome.value = ""; inputQtd.value = 1; inputPeso.value = ""; inputDesc.value = "";
        imagemAtualBase64 = null; btnExcluir.classList.add('hidden');
        document.querySelector('#modal-item h3').innerText = "NOVO ITEM"; btnSalvarItem.innerText = "ADICIONAR";
    }
    atualizarPreviewModal(); modal.classList.remove('hidden');
}

btnCancelar.onclick = () => modal.classList.add('hidden');
btnUpload.onclick = () => { window.abrirSeletor((img) => { imagemAtualBase64 = img; atualizarPreviewModal(); }); };

btnExcluir.onclick = () => {
    if (quadradoAtual.id.startsWith('inv-')) quadradoAtual.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    else quadradoAtual.innerHTML = quadradoAtual.getAttribute('data-original') + '<span class="text-lg text-black/30"><i class="fa-solid fa-upload"></i></span>';
    quadradoAtual.classList.remove('item-adicionado'); quadradoAtual.removeAttribute('data-itemData');
    quadradoAtual.removeAttribute('data-peso'); quadradoAtual.removeAttribute('data-qtd');
    recalcularPesoTotal(); modal.classList.add('hidden');
};

btnSalvarItem.onclick = () => {
    const nome = inputNome.value;
    const pesoString = inputPeso.value.replace(',', '.');
    const qtd = parseInt(inputQtd.value) || 0;
    if (!imagemAtualBase64) return alert("Escolha uma imagem.");
    if (!nome.trim()) return alert("Digite o nome.");
    if (qtd <= 0) return alert("Quantidade > 0.");
    if (inputPeso.value.trim() === "") return alert("Digite o peso.");
    
    const dados = { img: imagemAtualBase64, nome, qtd, peso: pesoString, desc: inputDesc.value };
    renderizarItem(quadradoAtual, dados); recalcularPesoTotal(); modal.classList.add('hidden');
};

function renderizarItem(q, dados) {
    const isEquipamento = !q.id.startsWith('inv-');
    const classeTexto = isEquipamento ? 'opacity-0 group-hover:opacity-100 transition-opacity' : 'opacity-100';
    q.innerHTML = `
        ${dados.img ? `<img src="${dados.img}" style="width: 100%; height: 100%; object-fit: contain; position: absolute; top: 0; left: 0; padding: 4px; z-index: 1;">` : ''}
        <div class="text-[10px] font-bold bg-black/40 text-white px-1 rounded leading-tight w-full absolute bottom-0 left-0 z-10 text-center ${classeTexto}">
            ${dados.nome} <br> <span class="text-gray-300">Qtd: ${dados.qtd}</span> | <span class="text-gray-300">${dados.peso}kg</span>
        </div>
        <div class="absolute inset-0 bg-black/80 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center pointer-events-none z-20">
            <span class="font-bold mb-1">EDITAR</span> ${dados.desc ? `<span class="italic text-gray-300 truncate w-full text-center">"${dados.desc}"</span>` : ''}
        </div>
    `;
    q.classList.add('item-adicionado'); q.dataset.itemData = JSON.stringify(dados);
    q.dataset.peso = dados.peso; q.dataset.qtd = dados.qtd;
}

if (gridInv) {
    for (let i = 0; i < 16; i++) {
        const q = document.createElement('div');
        q.id = `inv-${i}`;
        q.className = 'slot-vazio rounded aspect-square flex flex-col justify-center items-center relative text-center p-1 overflow-hidden group';
        q.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
        q.onclick = () => { if (q.classList.contains('item-adicionado')) abrirModal(q, JSON.parse(q.dataset.itemData)); else abrirModal(q); };
        gridInv.appendChild(q);
    }
}

const slotsEquipamento = document.querySelectorAll('.slot-vazio:not(#inventario .slot-vazio)');
slotsEquipamento.forEach(slot => {
    if(!slot.classList.contains('foto-personagem')) {
        slot.setAttribute('data-original', slot.innerHTML.split('<span')[0]);
        slot.removeAttribute('onclick');
        slot.onclick = () => { if (slot.classList.contains('item-adicionado')) abrirModal(slot, JSON.parse(slot.dataset.itemData)); else abrirModal(slot); };
    }
});

const listaT = document.getElementById('talentos');
if (listaT) {
    for (let i = 1; i <= 20; i++) {
        const l = document.createElement('div');
        l.className = 'flex items-center gap-2 border-b border-black/20 pb-1';
        l.innerHTML = `<span class="font-bold w-5 text-right text-[#111] text-sm">${i}.</span><input type="text" class="bg-transparent border-none outline-none font-semibold text-[#111] text-base w-full">`;
        listaT.appendChild(l);
    }
}

// --- SALVAR FICHA NA NUVEM ---
document.getElementById('btn-salvar-ficha').onclick = async () => {
    if (!usuarioAtual) return;
    const dadosFicha = {
        nome: document.getElementById('nome').value, idade: document.getElementById('idade').value,
        nivel: document.getElementById('nivel').value, exp: document.getElementById('exp').value,
        forca: forca.value, destreza: destreza.value, forcaAcao: forcaAcao.value, destrezaAcao: destrezaAcao.value,
        constituicao: document.getElementById('constituicao').value, inteligencia: document.getElementById('inteligencia').value,
        percepcao: document.getElementById('percepcao').value, vontade: document.getElementById('vontade').value,
        carisma: document.getElementById('carisma').value, esquiva: document.getElementById('esquiva').value,
        movimentacao: document.getElementById('movimentacao').value, diario: document.getElementById('diario').value,
        fotoPersonagem: document.getElementById('foto-personagem').innerHTML, itensMochila: [], itensEquipamento: []
    };
    document.querySelectorAll('#inventario .item-adicionado').forEach(el => { dadosFicha.itensMochila.push({ dados: JSON.parse(el.dataset.itemData), posicao: el.id }); });
    document.querySelectorAll('.slot-vazio.item-adicionado').forEach(el => { dadosFicha.itensEquipamento.push({ dados: JSON.parse(el.dataset.itemData), posicao: el.getAttribute('data-original') }); });
    try { await setDoc(doc(db, "fichas", usuarioAtual.uid), dadosFicha); alert("Ficha salva!"); } catch (e) { alert("Erro ao salvar."); }
};

async function carregarFicha() {
    if (!usuarioAtual) return;
    const docSnap = await getDoc(doc(db, "fichas", usuarioAtual.uid));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('nome').value = d.nome || ''; document.getElementById('idade').value = d.idade || '';
        document.getElementById('nivel').value = d.nivel || ''; document.getElementById('exp').value = d.exp || '';
        forca.value = d.forca || ''; destreza.value = d.destreza || ''; calcular();
        document.getElementById('constituicao').value = d.constituicao || ''; document.getElementById('inteligencia').value = d.inteligencia || '';
        document.getElementById('percepcao').value = d.percepcao || ''; document.getElementById('vontade').value = d.vontade || '';
        document.getElementById('carisma').value = d.carisma || ''; document.getElementById('esquiva').value = d.esquiva || '';
        document.getElementById('movimentacao').value = d.movimentacao || 6; document.getElementById('diario').value = d.diario || '';
        if(d.fotoPersonagem && d.fotoPersonagem.includes('img')) document.getElementById('foto-personagem').innerHTML = d.fotoPersonagem;
        document.querySelectorAll('.item-adicionado').forEach(el => el.classList.remove('item-adicionado'));
        if (d.itensMochila) d.itensMochila.forEach(item => { const el = document.getElementById(item.posicao); if(el) renderizarItem(el, item.dados); });
        if (d.itensEquipamento) d.itensEquipamento.forEach(item => { const el = Array.from(document.querySelectorAll('.slot-vazio')).find(e => e.getAttribute('data-original') === item.posicao); if(el) renderizarItem(el, item.dados); });
        recalcularPesoTotal();
    }
}

// --- PAINEL DO MESTRE ---
document.getElementById('btn-painel-mestre').onclick = async () => {
    document.getElementById('painel-mestre').classList.remove('hidden');
    const lista = document.getElementById('lista-jogadores'); lista.innerHTML = '<p>Buscando...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "fichas")); lista.innerHTML = '';
        if(querySnapshot.empty) return lista.innerHTML = '<p class="text-center mt-10">Nenhum sobrevivente.</p>';
        querySnapshot.forEach((doc) => {
            const ficha = doc.data();
            const div = document.createElement('div');
            div.className = 'border-b border-black/20 p-2 mb-2 flex justify-between items-center bg-white/20 rounded';
            div.innerHTML = `<div><strong>Nome:</strong> ${ficha.nome || 'Sem nome'} | <strong>Nível:</strong> ${ficha.nivel || 1} | <strong>Força:</strong> ${ficha.forca || '-'} (${ficha.forcaAcao || 0}%)</div>`;
            lista.appendChild(div);
        });
    } catch (e) { lista.innerHTML = '<p>Erro ao carregar.</p>'; }
};
document.getElementById('btn-fechar-mestre').onclick = () => document.getElementById('painel-mestre').classList.add('hidden');
