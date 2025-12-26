import request from 'supertest';
import { expect } from 'chai';
import { app } from '../src/app.js'; 

describe('WebService TermProject API 통합 테스트 (Postman & Cookie 반영)', function() {
  this.timeout(10000);
  
  let authCookie; 
  let workspaceId;
  let projectId;
  let taskId;
  let tagId;
  let commentId;

  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'user1'
  };

  it('1. 회원가입: Post /api/auth/signup', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testUser);
    expect([201, 409]).to.include(res.status);
  });

  it('2. 로그인: Post /api/auth/login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).to.equal(200);
    authCookie = res.headers['set-cookie']; 
    expect(authCookie).to.not.be.undefined;
  });

  it('3. 내 정보 조회: Get /api/users/me', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Cookie', authCookie);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('user');
  });

  it('4. 워크스페이스 생성: Post /api/workspaces', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Cookie', authCookie)
      .send({ name: `ws-${Date.now()}` });
    expect(res.status).to.equal(201);
    workspaceId = res.body.workspace.id;
  });

  it('5. 내 워크스페이스 목록: Get /api/workspaces', async () => {
    const res = await request(app)
      .get('/api/workspaces')
      .set('Cookie', authCookie);
    expect(res.status).to.equal(200);
  });

  it('6. 프로젝트 생성: Post /api/workspaces/:id/projects', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', authCookie)
      .send({ name: `proj-${Date.now()}` });
    expect(res.status).to.equal(201);
    projectId = res.body.project.id;
  });

  it('7. 태스크 생성: Post .../tasks', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set('Cookie', authCookie)
      .send({ title: 'New Task', status: 'TODO' });
    expect(res.status).to.equal(201);
    taskId = res.body.task.id;
  });

  it('8. 태그 생성: Post /api/workspaces/:id/tags', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/tags`)
      .set('Cookie', authCookie)
      .send({ name: `tag-${Date.now()}` });
    expect(res.status).to.equal(201);
    tagId = res.body.tag.id;
  });

  it('9. 태스크에 태그 부착: Post .../tags', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/tags`)
      .set('Cookie', authCookie)
      .send({ tagId: tagId });
    expect([200, 201]).to.include(res.status);
  });

  it('10. 댓글 생성: Post .../comments', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`)
      .set('Cookie', authCookie)
      .send({ content: 'Test Comment' });
    expect(res.status).to.equal(201);
    commentId = res.body.comment.id;
  });

  it('11. 특정 태스크 정보: Get .../tasks/:id', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', authCookie);
    expect(res.status).to.equal(200);
  });

  it('12. 태스크 정보 수정: Patch .../tasks/:id', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', authCookie)
      .send({ status: 'DOING' });
    expect(res.status).to.equal(200);
  });

  it('13. 워크스페이스 멤버 리스트: Get .../members', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', authCookie);
    expect(res.status).to.equal(200);
  });

  it('14. 400 에러 테스트: Post /tags (name 누락)', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/tags`)
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).to.equal(400);
  });

  it('15. 401 에러 테스트: 쿠키 없이 접근', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).to.equal(401);
  });

  it('16. 댓글 수정: Patch .../comments/:id', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`)
      .set('Cookie', authCookie)
      .send({ content: 'Updated content' });
    expect(res.status).to.equal(200);
  });

  it('17. 헬스 체크: Get /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).to.equal(200);
  });

  it('18. 댓글 삭제: Delete .../comments/:id', async () => {
    const res = await request(app)
      .delete(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`)
      .set('Cookie', authCookie);
    expect(res.status).to.equal(204);
  });

  it('19. 워크스페이스 삭제: Delete /api/workspaces/:id', async () => {
    const res = await request(app)
      .delete(`/api/workspaces/${workspaceId}`)
      .set('Cookie', authCookie);
    expect(res.status).to.equal(204);
  });

  it('20. 회원 탈퇴: Delete /api/users/me', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .set('Cookie', authCookie);
    expect(res.status).to.equal(204);
  });
});