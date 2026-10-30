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

// Variáveis de controle
let usuarioAtual = null;
const emailMestre = "rpgrupoc5@gmail.com"; // SEU E-MAIL DE MESTRE AQUI

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

// Monitora se o usuário está logado ou não
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        telaLogin.classList.add('hidden');
        sitePrincipal.classList.remove('hidden');
        carregarFicha(); // Puxa a ficha do banco de dados
        
        // Se for o mestre, mostra o botão de painel
        if (user.email === emailMestre) {
            document.getElementById('btn-painel-mestre').classList.remove('hidden');
        }
    } else {
        usuarioAtual = null;
        telaLogin.classList.remove('hidden');
        sitePrincipal.classList.add('hidden');
    }
});

// --- LÓGICA DOS ATRIBUTOS (Ação%) ---
const forca = document.getElementById('forca');
const destreza = document.getElementById('destreza');
const forcaAcao = document.getElementById('forca-acao');
const destrezaAcao = document.getElementById('destreza-acao');

function calcular() {
    if (forca.value) forcaAcao.value = parseInt(forca.value) * 3;
    if (destreza.value) destrezaAcao.value = parseInt(destreza.value) * 3;
}
if(forca) forca.addEventListener('input', calcular);
if(destreza) destreza.addEventListener('input', calcular);

// --- SISTEMA DE SALVAR FICHA NA NUVEM ---
document.getElementById('btn-salvar-ficha').onclick = async () => {
    if (!usuarioAtual) return;

    // Coleta os dados básicos
    const dadosFicha = {
        nome: document.getElementById('nome').value,
        idade: document.getElementById('idade').value,
        nivel: document.getElementById('nivel').value,
        exp: document.getElementById('exp').value,
        forca: forca.value,
        destreza: destreza.value,
        forcaAcao: forcaAcao.value,
        destrezaAcao: destrezaAcao.value,
        constituicao: document.getElementById('constituicao').value,
        inteligencia: document.getElementById('inteligencia').value,
        percepcao: document.getElementById('percepcao').value,
        vontade: document.getElementById('vontade').value,
        carisma: document.getElementById('carisma').value,
        esquiva: document.getElementById('esquiva').value,
        movimentacao: document.getElementById('movimentacao').value,
        diario: document.getElementById('diario').value,
        fotoPersonagem: document.getElementById('foto-personagem').innerHTML,
        itensMochila: [],
        itensEquipamento: []
    };

    // Coleta itens da mochila
    document.querySelectorAll('#inventario .item-adicionado').forEach(el => {
        dadosFicha.itensMochila.push({ dados: JSON.parse(el.dataset.itemData), posicao: el.id });
    });

    // Coleta itens do equipamento
    document.querySelectorAll('.slot-vazio.item-adicionado').forEach(el => {
        dadosFicha.itensEquipamento.push({ dados: JSON.parse(el.dataset.itemData), posicao: el.getAttribute('data-original') });
    });

    try {
        await setDoc(doc(db, "fichas", usuarioAtual.uid), dadosFicha);
        alert("Ficha salva na nuvem com sucesso!");
    } catch (e) {
        console.error("Erro ao salvar: ", e);
        alert("Erro ao salvar a ficha. Verifique sua conexão.");
    }
};

async function carregarFicha() {
    if (!usuarioAtual) return;
    const docRef = doc(db, "fichas", usuarioAtual.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('nome').value = d.nome || '';
        document.getElementById('idade').value = d.idade || '';
        document.getElementById('nivel').value = d.nivel || '';
        document.getElementById('exp').value = d.exp || '';
        forca.value = d.forca || '';
        destreza.value = d.destreza || '';
        calcular(); // Recalcula os %
        document.getElementById('constituicao').value = d.constituicao || '';
        document.getElementById('inteligencia').value = d.inteligencia || '';
        document.getElementById('percepcao').value = d.percepcao || '';
        document.getElementById('vontade').value = d.vontade || '';
        document.getElementById('carisma').value = d.carisma || '';
        document.getElementById('esquiva').value = d.esquiva || '';
        document.getElementById('movimentacao').value = d.movimentacao || 6;
        document.getElementById('diario').value = d.diario || '';
        
        if(d.fotoPersonagem && d.fotoPersonagem.includes('img')) {
             document.getElementById('foto-personagem').innerHTML = d.fotoPersonagem;
        }

        // Limpa itens antigos
        document.querySelectorAll('.item-adicionado').forEach(el => el.classList.remove('item-adicionado'));
        
        // Recria itens
        if (d.itensMochila) d.itensMochila.forEach(item => {
            const el = document.getElementById(item.posicao);
            if(el) renderizarItem(el, item.dados);
        });
        if (d.itensEquipamento) d.itensEquipamento.forEach(item => {
            const el = Array.from(document.querySelectorAll('.slot-vazio')).find(e => e.getAttribute('data-original') === item.posicao);
            if(el) renderizarItem(el, item.dados);
        });

        recalcularPesoTotal();
    }
}

// --- PAINEL DO MESTRE ---
document.getElementById('btn-painel-mestre').onclick = async () => {
    document.getElementById('painel-mestre').classList.remove('hidden');
    const lista = document.getElementById('lista-jogadores');
    lista.innerHTML = '<p>Buscando sobreviventes...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "fichas"));
        lista.innerHTML = '';
        if(querySnapshot.empty) {
            lista.innerHTML = '<p class="text-center mt-10">Nenhum sobrevivente cadastrado ainda.</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const ficha = doc.data();
            const div = document.createElement('div');
            div.className = 'border-b border-black/20 p-2 mb-2 flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <strong>Nome:</strong> ${ficha.nome || 'Sem nome'} | 
                    <strong>Nível:</strong> ${ficha.nivel || 1} | 
                    <strong>Força:</strong> ${ficha.forca || '-'} (${ficha.forcaAcao || 0}%)
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<p>Erro ao carregar fichas.</p>';
    }
};

document.getElementById('btn-fechar-mestre').onclick = () => {
    document.getElementById('painel-mestre').classList.add('hidden');
};

// --- FUNÇÕES DE IMAGEM E ITENS (O resto que você já tinha) ---
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

// ... (O restante do código de modal, itens, talentos, etc. continua igual) ...
// Cole aqui a parte do seu script antigo que cuidava do modal e dos itens.
// Para não quebrar, vou colocar uma versão simplificada das funções de item.
// Substitua o resto do script antigo por isso:

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

// (O resto do código do modal, botões de salvar item, etc., você cola aqui se já tiver)
// ...
