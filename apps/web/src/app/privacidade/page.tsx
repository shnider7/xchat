export const metadata = { title: "Política de Privacidade · ChatFlow" };
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-6 text-lg font-semibold">{children}</h2>;
export default function Privacidade() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <article className="glass space-y-3 rounded-3xl p-6 text-sm leading-relaxed md:p-10">
        <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
        <p className="opacity-60">Última atualização: [DATA]. Modelo inicial: revise com um profissional antes de publicar.</p>
        <H>1. Quem somos</H>
        <p>[NOME DA EMPRESA], [CNPJ], é a controladora dos dados tratados pelo ChatFlow. Contato do responsável pela privacidade: [EMAIL].</p>
        <H>2. Dados que tratamos</H>
        <p>Dados da conta (nome, email, senha em formato criptografado, foto); dados das contas conectadas pelo usuário (como o identificador e o nome de usuário do Instagram); mensagens, comentários e respostas trocados com os contatos do usuário; informações de origem do contato (como campanha e canal); registros de acesso e segurança.</p>
        <H>3. Para que usamos</H>
        <p>Prestar o serviço de automação de atendimento, exibir conversas e relatórios, enviar avisos de leads, proteger a plataforma contra abusos e cumprir obrigações legais.</p>
        <H>4. Com quem compartilhamos</H>
        <p>Com a Meta (para enviar e receber mensagens do Instagram), com o provedor de IA escolhido pelo próprio usuário (que usa a chave dele), com serviços de hospedagem e de envio de email. Não vendemos dados pessoais.</p>
        <H>5. Segurança</H>
        <p>Chaves e senhas são guardadas criptografadas, o acesso exige autenticação e há limites contra acessos abusivos. Nenhum sistema é totalmente imune a falhas, e comunicaremos incidentes conforme a lei.</p>
        <H>6. Por quanto tempo guardamos</H>
        <p>Enquanto a conta existir ou for necessário para cumprir obrigações legais. Ao excluir a conta, os dados dela e de seus contatos são apagados.</p>
        <H>7. Seus direitos (LGPD)</H>
        <p>Você pode pedir acesso, correção, portabilidade, informação sobre compartilhamento e a exclusão dos seus dados, escrevendo para [EMAIL].</p>
        <h2 id="exclusao" className="mt-6 text-lg font-semibold">8. Como excluir seus dados</h2>
        <p>Dentro do painel, em Perfil &gt; Conta &gt; Excluir minha conta, ou por email para [EMAIL]. Se você interagiu com o Instagram de um cliente nosso e quer apagar suas mensagens, peça a ele ou escreva para nós.</p>
      </article>
    </main>
  );
}
